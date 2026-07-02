import os
import inspect
from dotenv import load_dotenv,find_dotenv
load_dotenv(r'//home/fgm//scripts//pre-os-web//.env')

import time
import json
import logging
import requests
import psycopg2
from psycopg2.extras import RealDictCursor
from requests.exceptions import RequestException
import csv
import re
import xml.etree.ElementTree as ET

# Configuração de Logs
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Configurações do SFMC
SFMC_AUTH_BASE_URL = os.getenv("SFMC_AUTH_BASE_URL", "https://<subdomain>.auth.marketingcloudapis.com/")
SFMC_AUTH_URL = f"{SFMC_AUTH_BASE_URL.rstrip('/')}/v2/token"
SFMC_REST_URL = os.getenv("SFMC_API_BASE_URL", "https://<subdomain>.rest.marketingcloudapis.com").rstrip('/')
SFMC_CLIENT_ID = os.getenv("SFMC_CLIENT_ID")
SFMC_CLIENT_SECRET = os.getenv("SFMC_CLIENT_SECRET")
SFMC_DATA_EXTENSION_ID_FATURAMENTO = os.getenv("SFMC_DATA_EXTENSION_ID_FATURAMENTO")
SFMC_DATA_EXTENSION_ID_META = os.getenv("SFMC_DATA_EXTENSION_ID_META")
SFMC_DATA_EXTENSION_ID_ORG_VENDA = os.getenv("SFMC_DATA_EXTENSION_ID_ORG_VENDA")
SFMC_DATA_EXTENSION_ID_MATERIAL = os.getenv("SFMC_DATA_EXTENSION_ID_MATERIAL")
SFMC_DATA_EXTENSION_ID_SHELF_LIFE = os.getenv("SFMC_DATA_EXTENSION_ID_SHELF_LIFE")
SFMC_DATA_EXTENSION_ID_PRECO = os.getenv("SFMC_DATA_EXTENSION_ID_PRECO")
SFMC_DATA_EXTENSION_ID_ORDEM_FATURAMENTO = os.getenv("SFMC_DATA_EXTENSION_ID_ORDEM_FATURAMENTO")

# Configurações de Banco de Dados
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")

# Configurações do Job
CHUNK_SIZE = int(os.getenv("SFMC_CHUNK_SIZE",2400))
MAX_RETRIES = 5

def get_db_connection():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )

def get_sfmc_token():
    logger.info("Obtendo token de autenticação do SFMC...")
    payload = {
        "grant_type": "client_credentials",
        "client_id": SFMC_CLIENT_ID,
        "client_secret": SFMC_CLIENT_SECRET
    }
    response = requests.post(SFMC_AUTH_URL, json=payload, verify=False)
    response.raise_for_status()
    token_data = response.json()
    return token_data.get("access_token")

def fetch_active_seller_codes(token):
    """
    Recupera a lista de SellerCode__c ativos a partir da Data Extension Sincronizada
    User_Salesforce no SFMC via SOAP API. Como fallback, tenta ler o arquivo local
    User_Salesforce.csv se existir no diretório de execução.
    """
    logger.info("Buscando códigos de representantes ativos do SFMC...")
    
    # 1. Tentar via SOAP API
    try:
        # Derivar URL SOAP a partir da URL REST
        match = re.search(r'https://([^.]+)\.rest\.marketingcloudapis\.com', SFMC_REST_URL)
        if match:
            tenant = match.group(1)
            soap_url = f"https://{tenant}.soap.marketingcloudapis.com/Service.asmx"
        else:
            soap_url = SFMC_REST_URL.replace(".rest.", ".soap.").rstrip('/') + "/Service.asmx"
            
        soap_body = f"""<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <soapenv:Header>
    <fueloauth>{token}</fueloauth>
  </soapenv:Header>
  <soapenv:Body>
    <RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI">
      <RetrieveRequest>
        <ObjectType>DataExtensionObject[User_Salesforce]</ObjectType>
        <Properties>SellerCode__c</Properties>
      </RetrieveRequest>
    </RetrieveRequestMsg>
  </soapenv:Body>
</soapenv:Envelope>"""

        headers = {
            "Content-Type": "text/xml; charset=utf-8",
            "SOAPAction": "Retrieve"
        }

        response = requests.post(soap_url, data=soap_body, headers=headers, timeout=30, verify=False)
        if response.status_code == 200:
            root = ET.fromstring(response.text)
            ns = {'ns': 'http://exacttarget.com/wsdl/partnerAPI'}
            results = root.findall('.//ns:Results', ns)
            
            seller_codes = set()
            for res in results:
                properties = res.find('ns:Properties', ns)
                if properties is not None:
                    for prop in properties.findall('ns:Property', ns):
                        name = prop.find('ns:Name', ns).text
                        val = prop.find('ns:Value', ns).text
                        if name == 'SellerCode__c' and val and val.strip():
                            try:
                                seller_codes.add(int(val.strip()))
                            except ValueError:
                                pass
            
            if seller_codes:
                logger.info(f"Sucesso: {len(seller_codes)} códigos de representantes ativos obtidos via SOAP API.")
                return seller_codes
            else:
                logger.warning("SOAP API não retornou nenhum SellerCode__c válido.")
        else:
            logger.warning(f"Falha na requisição SOAP (Status {response.status_code}): {response.text}")
    except Exception as e:
        logger.warning(f"Erro ao buscar códigos via SOAP API: {str(e)}")

    # 2. Fallback para arquivo CSV local
    logger.info("Tentando obter códigos a partir do CSV local como fallback...")
    csv_path = "User_Salesforce.csv"
    if not os.path.exists(csv_path):
        csv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "User_Salesforce.csv")

    if os.path.exists(csv_path):
        try:
            seller_codes = set()
            with open(csv_path, mode='r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    code = row.get("SellerCode__c")
                    if code and code.strip():
                        try:
                            seller_codes.add(int(code.strip()))
                        except ValueError:
                            pass
            if seller_codes:
                logger.info(f"Sucesso: {len(seller_codes)} códigos de representantes ativos carregados do CSV local {csv_path}.")
                return seller_codes
        except Exception as e:
            logger.error(f"Erro ao ler CSV local {csv_path}: {str(e)}")
    else:
        logger.warning(f"Arquivo CSV local {csv_path} não encontrado.")

    logger.error("Não foi possível carregar os códigos dos representantes ativos por nenhum método.")
    return set()

def fetch_faturamento_delta(seller_codes, chunk_size=2400):
    """
    Busca os dados de faturamento (histórico completo), filtrando apenas as linhas onde 
    'Cód. Representante Carteira' é um dos códigos de representante ativos fornecidos.
    Usa um cursor do lado do servidor para streaming eficiente.
    """
    logger.info("Consultando registros de FATURAMENTO no banco de dados (Streaming)...")
    query = """
    SELECT 
        f."OV"                          as ov,
        f."Item OV"                     as item_ov,
        f."Cliente"                     as cliente,
        f."Cód. Representante OV"       as cod_representante_ov,
        f."Cód. Representante Carteira" as cod_representante_carteira,
        f."Doc. Faturamento"            as doc_faturamento,
        f."Data Faturamento"            as data_faturamento,
        f."Data Criação OV"             as data_criacao_ov,
        f."Valor Líquido Faturado BRL"  as valor_liquido_faturado_brl,
        f."Material"                    as material
    FROM warehouse.f_ordem_faturamento f
    """
    
    params = []
    if seller_codes:
        placeholders = ', '.join(['%s'] * len(seller_codes))
        query += f'\n    WHERE f."Cód. Representante Carteira"::bigint IN ({placeholders})'
        params = list(seller_codes)
    else:
        logger.warning("Nenhum código de vendedor ativo fornecido. A consulta de faturamento não será filtrada por representante.")

    # Criamos uma conexão dedicada ao streaming de faturamento
    conn = get_db_connection()
    cur = conn.cursor(name="faturamento_stream_cursor", cursor_factory=RealDictCursor)
    try:
        cur.execute(query, params)
        while True:
            rows = cur.fetchmany(chunk_size)
            if not rows:
                break
            yield rows
    finally:
        cur.close()
        conn.close()
        logger.info("Cursor do lado do servidor para FATURAMENTO finalizado e conexões fechadas.")

def fetch_meta_delta(chunk_size=2400):
    """
    Busca os dados de meta (tabela warehouse.f_meta) usando um cursor do lado do servidor 
    para evitar estouro de memória com os 5.4 milhões de registros.
    Retorna um generator que produz lotes de registros.
    """
    logger.info("Consultando registros de META no banco de dados (Streaming)...")
    query = """
    SELECT 
        m."Chave Meta"        as chave_meta,
        m."Ano"               as ano,
        m."Mês"               as mes,
        m."CodRepresentante"  as codrepresentante,
        m."Cod Cliente"       as cod_cliente,
        m."Material SAP"      as material,
        m."Qtde Meta"         as qtde_meta,
        m."Valor Meta"        as valor_meta
    FROM warehouse.f_meta m
    WHERE m."Ano" = '2026'
    """
    
    # Criamos uma nova conexão dedicada ao streaming para manter o cursor do lado do servidor aberto
    conn = get_db_connection()
    # Usando cursor nomeado para ativar cursor do lado do servidor (server-side cursor)
    cur = conn.cursor(name="meta_stream_cursor", cursor_factory=RealDictCursor)
    try:
        cur.execute(query)
        while True:
            rows = cur.fetchmany(chunk_size)
            if not rows:
                break
            yield rows
    finally:
        cur.close()
        conn.close()
        logger.info("Cursor do lado do servidor para META finalizado e conexões fechadas.")

def format_faturamento_for_sfmc(records):
    """
    Transforma os registros de Faturamento do DB no formato esperado pela Data Extension.
    """
    formatted_items = []
    for row in records:
        ov = str(row.get('ov', ''))
        item_ov = str(row.get('item_ov', ''))
        pk = f"{ov}_{item_ov}"
        
        valor_brl = row.get('valor_liquido_faturado_brl')
        valor_brl_fmt = f"{float(valor_brl):.2f}" if valor_brl is not None else "0.00"

        data_fat = row.get('data_faturamento')
        data_fat_str = data_fat.strftime('%Y-%m-%d') if data_fat else None

        data_criacao = row.get('data_criacao_ov')
        data_criacao_str = data_criacao.strftime('%Y-%m-%d') if data_criacao else None

        item = {
            "OV_ItemOV_PK": pk,
            "OV": ov,
            "Item_OV": item_ov,
            "Cliente": str(row.get('cliente', '')),
            "Cod_Representante_OV": str(row.get('cod_representante_ov', '')),
            "Cod_Representante_Carteira": str(row.get('cod_representante_carteira', '')),
            "Doc_Faturamento": str(row.get('doc_faturamento', '')),
            "Data_Faturamento": data_fat_str,
            "Criacao_OV": data_criacao_str,
            "Valor_Liquido_Faturado_BRL": valor_brl_fmt,
            "Chave_Meta": str(row.get('chave_meta', ''))
        }
        formatted_items.append(item)
    return formatted_items

def format_meta_for_sfmc(records):
    """
    Transforma os registros de Meta do DB no formato esperado pela Data Extension.
    """
    formatted_items = []
    for row in records:
        pk = str(row.get('chave_meta', ''))
        
        qtde_meta = row.get('qtde_meta')
        qtde_meta_fmt = f"{float(qtde_meta):.2f}" if qtde_meta is not None else "0.00"

        valor_meta = row.get('valor_meta')
        valor_meta_fmt = f"{float(valor_meta):.2f}" if valor_meta is not None else "0.00"

        item = {
            "Chave_Meta": pk,
            "Ano": str(row.get('ano', '')),
            "Mes": str(row.get('mes', '')),
            "CodRepresentante": str(row.get('codrepresentante', '')),
            "Cod_Cliente": str(row.get('cod_cliente', '')),
            "Material": str(row.get('material', '')),
            "Qtde_Meta": qtde_meta_fmt,
            "Valor_Meta": valor_meta_fmt
        }
        formatted_items.append(item)
    return formatted_items

def send_to_sfmc_with_retry(token, items_chunk, chunk_index, de_id, topic):
    """
    Envia um lote de dados para o SFMC via Async REST API com suporte a Retry.
    """
    if not de_id:
        logger.warning(f"[{topic}] Lote {chunk_index} abortado: Data Extension ID não configurado nas variáveis de ambiente.")
        return False

    url = f"{SFMC_REST_URL}/data/v1/async/dataextensions/key:{de_id}/rows"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    payload = {"items": items_chunk}
    
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            logger.info(f"[{topic}] Lote {chunk_index} - Tentativa {attempt}/{MAX_RETRIES} - Enviando {len(items_chunk)} registros...")
            response = requests.post(url, headers=headers, json=payload, timeout=30, verify=False)
            
            if response.status_code in [200, 202]:
                logger.info(f"[{topic}] Lote {chunk_index} processado com sucesso pelo SFMC. Status: {response.status_code}")
                return True
            elif response.status_code == 401:
                logger.error(f"[{topic}] Token expirado (401). Abortando tentativa para renovação.")
                raise Exception("Unauthorized")
            elif response.status_code == 429 or response.status_code >= 500:
                logger.warning(f"[{topic}] Lote {chunk_index} - Falha transitória (Status: {response.status_code}).")
            else:
                logger.error(f"[{topic}] Lote {chunk_index} falhou permanentemente. Status: {response.status_code}. Response: {response.text}")
                return False

        except (RequestException, Exception) as e:
            logger.warning(f"[{topic}] Lote {chunk_index} - Erro na requisição: {str(e)}")
            if str(e) == "Unauthorized":
                raise

        if attempt < MAX_RETRIES:
            sleep_time = (2 ** attempt)
            logger.info(f"[{topic}] Lote {chunk_index} - Aguardando {sleep_time} segundos antes da próxima tentativa...")
            time.sleep(sleep_time)
            
    logger.error(f"[{topic}] Lote {chunk_index} - Falha após {MAX_RETRIES} tentativas. Abortando lote.")
    return False

def clear_data_extension(token, de_key):
    """
    Limpa todos os dados da Data Extension especificada usando a SOAP API (Perform ClearData).
    """
    logger.info(f"Limpando Data Extension {de_key}...")
    try:
        match = re.search(r'https://([^.]+)\.rest\.marketingcloudapis\.com', SFMC_REST_URL)
        if match:
            tenant = match.group(1)
            soap_url = f"https://{tenant}.soap.marketingcloudapis.com/Service.asmx"
        else:
            soap_url = SFMC_REST_URL.replace(".rest.", ".soap.").rstrip('/') + "/Service.asmx"

        soap_body = f"""<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <soapenv:Header>
    <fueloauth>{token}</fueloauth>
  </soapenv:Header>
  <soapenv:Body>
    <PerformRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI">
      <Action>ClearData</Action>
      <Definitions>
        <Definition xsi:type="DataExtension">
          <CustomerKey>{de_key}</CustomerKey>
        </Definition>
      </Definitions>
    </PerformRequestMsg>
  </soapenv:Body>
</soapenv:Envelope>"""

        headers = {
            "Content-Type": "text/xml; charset=utf-8",
            "SOAPAction": "Perform"
        }

        response = requests.post(soap_url, data=soap_body, headers=headers, timeout=30, verify=False)
        if response.status_code == 200:
            if "cleared successfully" in response.text or "<StatusCode>OK</StatusCode>" in response.text:
                logger.info(f"Data Extension {de_key} limpa com sucesso.")
                return True
            else:
                logger.warning(f"Resposta inesperada ao limpar a Data Extension {de_key}: {response.text}")
        else:
            logger.error(f"Erro na chamada SOAP para limpar a Data Extension {de_key} (Status {response.status_code}): {response.text}")
    except Exception as e:
        logger.error(f"Erro ao tentar limpar a Data Extension {de_key}: {str(e)}")
    return False

def send_chunk_helper(topic, chunk, chunk_index, de_id, token):
    try:
        success = send_to_sfmc_with_retry(token, chunk, chunk_index, de_id, topic)
        return success, token
    except Exception as e:
        if str(e) == "Unauthorized":
            logger.info(f"[{topic}] Tentando renovar o token do SFMC...")
            try:
                token = get_sfmc_token()
                success = send_to_sfmc_with_retry(token, chunk, chunk_index, de_id, topic)
                return success, token
            except Exception as inner_e:
                logger.error(f"[{topic}] Erro ao renovar token no lote {chunk_index}: {str(inner_e)}")
                return False, token
        else:
            logger.error(f"[{topic}] Erro fatal no lote {chunk_index}: {str(e)}")
            return False, token

def sync_data(topic, records, formatter_fn, de_id, token):
    """
    Orquestra a formatação e divisão de lotes para um determinado escopo (Faturamento ou Meta).
    Suporta records sendo uma lista ou um generator.
    """
    if not records:
        logger.info(f"[{topic}] Nenhum dado para sincronizar.")
        return token

    # Limpar DE antes de começar se for Meta (conforme solicitado pelo usuário para sobrescrever)
    if topic == "Meta":
        logger.info(f"[{topic}] Limpando registros antigos na Data Extension via SOAP ClearData...")
        try:
            clear_data_extension(token, de_id)
        except Exception as e:
            logger.error(f"[{topic}] Erro ao limpar a Data Extension: {str(e)}")

    is_generator = inspect.isgenerator(records)

    if not is_generator:
        sfmc_items = formatter_fn(records)
        total_items = len(sfmc_items)
        total_chunks = (total_items + CHUNK_SIZE - 1) // CHUNK_SIZE
        logger.info(f"[{topic}] Iniciando envio para SFMC (Lista). {total_items} registros em {total_chunks} lotes.")
        
        successful_chunks = 0
        for i in range(0, total_items, CHUNK_SIZE):
            chunk = sfmc_items[i:i + CHUNK_SIZE]
            chunk_index = (i // CHUNK_SIZE) + 1
            success, token = send_chunk_helper(topic, chunk, chunk_index, de_id, token)
            if success:
                successful_chunks += 1
        logger.info(f"[{topic}] Sincronização finalizada. {successful_chunks}/{total_chunks} lotes enviados.")
    else:
        logger.info(f"[{topic}] Iniciando envio para SFMC (Streaming com cursor do lado do servidor)...")
        successful_chunks = 0
        chunk_index = 1
        for db_chunk in records:
            sfmc_chunk = formatter_fn(db_chunk)
            success, token = send_chunk_helper(topic, sfmc_chunk, chunk_index, de_id, token)
            if success:
                successful_chunks += 1
            chunk_index += 1
        logger.info(f"[{topic}] Sincronização finalizada (Streaming). {successful_chunks} lotes enviados com sucesso.")

    return token

def fetch_simple_table(table_name, columns, chunk_size=2400):
    logger.info(f"Consultando registros de {table_name} no banco de dados (Streaming)...")
    cols_str = ", ".join([f'"{c}"' for c in columns])
    query = f"SELECT {cols_str} FROM warehouse.{table_name}"
    
    conn = get_db_connection()
    cur = conn.cursor(name=f"{table_name}_stream_cursor", cursor_factory=RealDictCursor)
    try:
        cur.execute(query)
        while True:
            rows = cur.fetchmany(chunk_size)
            if not rows:
                break
            yield rows
    finally:
        cur.close()
        conn.close()
        logger.info(f"Cursor de {table_name} finalizado.")


def format_shelf_life(records):
    formatted = []
    for r in records:
        dp = r.get('Data de produção')
        dv = r.get('Data do vencimento')
        
        # Limitar o texto a 50 caracteres para respeitar o schema do SFMC
        texto = str(r.get('Texto breve de material', ''))[:50]
        
        # Quantidade de estoque deve ser enviada como inteiro
        estoque_float = float(r.get('Quantidade Estoque') or 0)
        estoque_int = int(estoque_float)
        
        formatted.append({
            "produto_codigo": str(r.get('Nº do material', '')),
            "centro": str(r.get('Centro', '')),
            "data_producao": dp.strftime('%Y-%m-%d') if dp else "",
            "texto_breve_material": texto,
            "data_vencimento": dv.strftime('%Y-%m-%d') if dv else "",
            "quantidade_estoque": str(estoque_int)
        })
    return formatted


def format_ordem_fat_full(records):
    return [{
        "chave_representante_ov": str(r.get('Cód. Representante OV', '')),
        "material": str(r.get('Material', ''))
    } for r in records]


def process_sync():
    """Fluxo principal do job"""
    try:
        # Autenticação inicial
        token = get_sfmc_token()

        # 1. Obter códigos de representantes ativos (User_Salesforce)
        seller_codes = fetch_active_seller_codes(token)

        # 2. Sincronizar Faturamento
        fat_records = fetch_faturamento_delta(seller_codes)
        token = sync_data(
            topic="Faturamento", 
            records=fat_records, 
            formatter_fn=format_faturamento_for_sfmc, 
            de_id=SFMC_DATA_EXTENSION_ID_FATURAMENTO, 
            token=token
        )
        
        # 3. Sincronizar Metas
        meta_records = fetch_meta_delta()
        token = sync_data(
            topic="Meta", 
            records=meta_records, 
            formatter_fn=format_meta_for_sfmc, 
            de_id=SFMC_DATA_EXTENSION_ID_META, 
            token=token
        )



        # 8. Sincronizar f_ordem_faturamento_full
        clear_data_extension(token, SFMC_DATA_EXTENSION_ID_ORDEM_FATURAMENTO)
        ordf_records = fetch_simple_table('f_ordem_faturamento', ['Cód. Representante OV', 'Material'])
        token = sync_data("f_ordem_faturamento", ordf_records, format_ordem_fat_full, SFMC_DATA_EXTENSION_ID_ORDEM_FATURAMENTO, token)

    except Exception as e:
        logger.error(f"Falha na sincronização diária geral: {str(e)}")

if __name__ == "__main__":
    logger.info("--- Iniciando Job de Integração para SFMC ---")
    process_sync()
