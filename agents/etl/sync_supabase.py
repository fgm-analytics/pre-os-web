import os
import csv
import logging
import psycopg2
import requests
import re
import xml.etree.ElementTree as ET
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from supabase import create_client, Client

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

# Load configurations
load_dotenv()

# Disable SSL warnings
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def get_sfmc_token():
    logger.info("Obtendo token de autenticação do SFMC...")
    SFMC_AUTH_BASE_URL = os.getenv("SFMC_AUTH_BASE_URL", "https://mczx4ly-2825664pz87wbsqth8p8.auth.marketingcloudapis.com/")
    SFMC_AUTH_URL = f"{SFMC_AUTH_BASE_URL.rstrip('/')}/v2/token"
    SFMC_CLIENT_ID = os.getenv("SFMC_CLIENT_ID")
    SFMC_CLIENT_SECRET = os.getenv("SFMC_CLIENT_SECRET")
    payload = {
        "grant_type": "client_credentials",
        "client_id": SFMC_CLIENT_ID,
        "client_secret": SFMC_CLIENT_SECRET
    }
    response = requests.post(SFMC_AUTH_URL, json=payload, verify=False)
    response.raise_for_status()
    token_data = response.json()
    return token_data.get("access_token")

def fetch_client_names_from_sfmc(token, sfmc_rest_url):
    logger.info("Fetching client names from SFMC Account_Salesforce DE...")
    match = re.search(r'https://([^.]+)\.rest\.marketingcloudapis\.com', sfmc_rest_url)
    if match:
        tenant = match.group(1)
        soap_url = f"https://{tenant}.soap.marketingcloudapis.com/Service.asmx"
    else:
        soap_url = sfmc_rest_url.replace(".rest.", ".soap.").rstrip('/') + "/Service.asmx"

    headers = {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": "Retrieve"
    }

    client_map = {}
    request_id = None
    has_more = True
    page = 1

    while has_more:
        if not request_id:
            soap_body = f"""<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <soapenv:Header>
    <fueloauth>{token}</fueloauth>
  </soapenv:Header>
  <soapenv:Body>
    <RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI">
      <RetrieveRequest>
        <ObjectType>DataExtensionObject[Account_Salesforce]</ObjectType>
        <Properties>CorporateCode__c</Properties>
        <Properties>Name</Properties>
      </RetrieveRequest>
    </RetrieveRequestMsg>
  </soapenv:Body>
</soapenv:Envelope>"""
        else:
            soap_body = f"""<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <soapenv:Header>
    <fueloauth>{token}</fueloauth>
  </soapenv:Header>
  <soapenv:Body>
    <RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI">
      <RetrieveRequest>
        <ContinueRequest>{request_id}</ContinueRequest>
      </RetrieveRequest>
    </RetrieveRequestMsg>
  </soapenv:Body>
</soapenv:Envelope>"""

        try:
            res = requests.post(soap_url, data=soap_body, headers=headers, timeout=30, verify=False)
            if res.status_code != 200:
                logger.error(f"Failed to fetch page {page} from SFMC: {res.status_code}")
                break
            
            root = ET.fromstring(res.text)
            ns = {'ns': 'http://exacttarget.com/wsdl/partnerAPI'}
            
            # Find request id for next page
            req_id_elem = root.find('.//ns:RequestID', ns)
            request_id = req_id_elem.text if req_id_elem is not None else None
            
            # Check status
            status_elem = root.find('.//ns:OverallStatus', ns)
            status = status_elem.text if status_elem is not None else ""
            has_more = (status == "MoreDataAvailable")
            
            results = root.findall('.//ns:Results', ns)
            logger.info(f"Page {page}: retrieved {len(results)} accounts from SFMC (Status: {status})")
            
            for r in results:
                properties = r.find('ns:Properties', ns)
                code = None
                name = None
                if properties is not None:
                    for prop in properties.findall('ns:Property', ns):
                        pname = prop.find('ns:Name', ns).text
                        pval = prop.find('ns:Value', ns).text
                        if pname == 'CorporateCode__c':
                            code = pval
                        elif pname == 'Name':
                            name = pval
                if code and name:
                    client_map[str(code).strip()] = str(name).strip()
            
            page += 1
            if page > 50: # safety limit to avoid infinite loop
                break
        except Exception as e:
            logger.error(f"Error fetching client names from SFMC on page {page}: {e}")
            break

    logger.info(f"Finished fetching client names. Total unique clients mapped: {len(client_map)}")
    return client_map

# Source DB (DWH PostgreSQL)
DB_HOST = os.getenv("DB_HOST", "10.200.10.45")
DB_PORT = os.getenv("DB_PORT", "5433")
DB_NAME = os.getenv("DB_NAME", "dw_prd")
DB_USER = os.getenv("DB_USER", "rpa_analytics")
DB_PASSWORD = os.getenv("DB_PASSWORD", "Dev2026!FGM@")

# Destination (Supabase)
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") # Use service role key to bypass RLS for write operations

def get_dwh_connection():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        connect_timeout=10
    )

def sync_users_and_hierarchy(supabase_client: Client):
    logger.info("Starting synchronization of users and hierarchy...")
    csv_path = "User_Salesforce.csv"
    if not os.path.exists(csv_path):
        logger.error(f"User_Salesforce.csv not found at project root.")
        return

    # 1. Read CSV
    users = []
    managers_map = {} # Salesforce ID -> SellerCode
    with open(csv_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            is_active = str(row.get("IsActive", "")).lower() == "true"
            if not is_active:
                continue
            
            seller_code = None
            raw_code = row.get("SellerCode__c")
            if raw_code and raw_code.strip():
                try:
                    seller_code = int(float(raw_code.strip()))
                except ValueError:
                    pass

            user_data = {
                "id_sf": row.get("Id"),
                "email": row.get("Email"),
                "nome": row.get("Name"),
                "vendedor_code": seller_code,
                "manager_id": row.get("ManagerId"),
                "role": "vendedor" # Default role, will upgrade to manager/admin based on logic
            }
            users.append(user_data)
            if seller_code and user_data["id_sf"]:
                managers_map[user_data["id_sf"]] = seller_code

    # Identify managers (anyone who is a manager to another active user)
    manager_ids_in_use = set(u["manager_id"] for u in users if u["manager_id"])
    
    # Let's map who gets which role
    for u in users:
        # If they are a manager to someone
        if u["id_sf"] in manager_ids_in_use:
            u["role"] = "gerente"
        # Admin overrides
        if u["email"] in ["sean.quadros@fgmdentalgroup.com", "admin@fgmdentalgroup.com"]:
            u["role"] = "admin"
            
        # Exception Rules for Hierarchy overrides
        if u["vendedor_code"] == 1191:
            u["manager_id"] = "005V200000K2uVdIAJ" # Ride Junior
        elif u["vendedor_code"] in [107, 334]:
            u["manager_id"] = "005V200000K2rvxIAB" # Ricardo Amorim

    logger.info(f"Loaded {len(users)} active users from User_Salesforce.csv")

    # In Supabase, auth.users must be created first to link to public.usuarios.
    # For now, we will upsert users into public.usuarios if they exist (linked via UUID).
    # NOTE: Since auth users are created through signup/invite flow in Supabase Auth,
    # this script will check if there's an existing mapping. We can insert mock/pre-configured accounts, 
    # or the app can auto-create the public.usuarios profile on first sign-in.
    # To support that, we will upsert the hierarchy data directly, as it doesn't depend on auth.users.
    
    # Upsert public.hierarquia_vendedores
    hierarchy_records = []
    for u in users:
        if u["manager_id"] and u["manager_id"] in managers_map:
            hierarchy_records.append({
                "gerente_salesforce_id": u["manager_id"],
                "gerente_vendedor_code": managers_map[u["manager_id"]],
                "subordinado_salesforce_id": u["id_sf"],
                "subordinado_vendedor_code": u["vendedor_code"]
            })
            
    logger.info(f"Upserting {len(hierarchy_records)} hierarchy records to Supabase...")
    if hierarchy_records:
        # Batch upsert
        res = supabase_client.table("hierarquia_vendedores").upsert(
            hierarchy_records, 
            on_conflict="gerente_salesforce_id,subordinado_salesforce_id"
        ).execute()
        logger.info("Hierarchy synced successfully.")

def sync_faturamento(supabase_client: Client):
    logger.info("Syncing historical billing data...")
    # Fetch active seller codes to filter
    csv_path = "User_Salesforce.csv"
    seller_codes = set()
    with open(csv_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            code = row.get("SellerCode__c")
            if code and code.strip():
                try:
                    seller_codes.add(int(float(code.strip())))
                except ValueError:
                    pass

    if not seller_codes:
        logger.error("No active seller codes found. Aborting faturamento sync.")
        return

    conn = get_dwh_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # We query f_ordem_faturamento_sap and group by vendedor, cliente, ano, mes to keep the volume low.
    # We do a LEFT JOIN with d_material or use the product categories from materials to categorize volume.
    # But wait: the prompt mentions grouping by vendedor_code, vendedor_nome, cliente_code, cliente_nome, ano, mes.
    # Let's write the query to fetch aggregated records directly from PostgreSQL.
    
    placeholders = ','.join(['%s'] * len(seller_codes))
    
    # Let's aggregate: realizados (valor faturado e volume)
    # The billing table f_ordem_faturamento_sap has:
    # "Cód. Representante Carteira" as cod_rep
    # "Representante OV" or we can lookup seller names. Let's select the representative name from the row.
    # "Cliente" as cliente_code, and we need a name. Let's look up.
    # Let's read seller names from CSV directly for clean names
    seller_names_map = {}
    with open(csv_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            code = row.get("SellerCode__c")
            name = row.get("Name")
            if code and code.strip() and name:
                try:
                    seller_names_map[int(float(code.strip()))] = name.strip().upper()
                except ValueError:
                    pass

    query = f"""
    SELECT 
        f."Cód. Representante Carteira"::integer as vendedor_code,
        f."Cliente" as cliente_code,
        COALESCE(MAX(c."Cliente"), f."Cliente") as cliente_nome,
        EXTRACT(YEAR FROM f."Data Faturamento")::integer as ano,
        EXTRACT(MONTH FROM f."Data Faturamento")::integer as mes,
        SUM(f."Valor Líquido Faturado BRL") as realizado_faturamento,
        SUM(f."Qtde Faturada") as realizado_volume
    FROM warehouse.f_ordem_faturamento_sap f
    LEFT JOIN warehouse.d_cliente c ON f."Cliente"::text = c."Cód Cliente"::text
    WHERE f."Cód. Representante Carteira"::bigint IN ({placeholders})
      AND f."Data Faturamento" IS NOT NULL
    GROUP BY 
        f."Cód. Representante Carteira"::integer,
        f."Cliente",
        EXTRACT(YEAR FROM f."Data Faturamento"),
        EXTRACT(MONTH FROM f."Data Faturamento")
    """
    logger.info("Executing DWH aggregation query for faturamento...")
    cur.execute(query, list(seller_codes))
    rows = cur.fetchall()
    logger.info(f"Retrieved {len(rows)} aggregated faturamento records from DWH.")

    # Fetch client names from SFMC Account_Salesforce DE
    client_names_map = {}
    try:
        token = get_sfmc_token()
        SFMC_REST_URL = os.getenv("SFMC_API_BASE_URL", "https://mczx4ly-2825664pz87wbsqth8p8.rest.marketingcloudapis.com").rstrip('/')
        client_names_map = fetch_client_names_from_sfmc(token, SFMC_REST_URL)
    except Exception as e:
        logger.error(f"Error fetching client names from SFMC: {e}")

    # Convert to list of dicts for Supabase upsert
    records = []
    for r in rows:
        c_code = str(r["cliente_code"]).strip()
        c_name = client_names_map.get(c_code) or r["cliente_nome"] or f"Cliente {r['cliente_code']}"
        vcode = r["vendedor_code"]
        records.append({
            "vendedor_code": vcode,
            "vendedor_nome": seller_names_map.get(vcode, f"Representante {vcode}"),
            "cliente_code": r["cliente_code"],
            "cliente_nome": c_name,
            "ano": r["ano"],
            "mes": r["mes"],
            "realizado_faturamento": float(r["realizado_faturamento"] or 0),
            "realizado_volume": float(r["realizado_volume"] or 0)
        })

    # Upsert in chunks of 1000
    chunk_size = 1000
    total_upserted = 0
    for i in range(0, len(records), chunk_size):
        chunk = records[i:i+chunk_size]
        supabase_client.table("historico_faturamento").upsert(
            chunk,
            on_conflict="vendedor_code,cliente_code,ano,mes"
        ).execute()
        total_upserted += len(chunk)
        logger.info(f"Upserted {total_upserted}/{len(records)} faturamento records...")

    cur.close()
    conn.close()

def sync_performance_2026(supabase_client: Client):
    logger.info("Syncing 2026 performance data (meta vs realizado by subgrupo)...")
    # To build the performance_vendedor_2026 table:
    # 1. Fetch all goals (meta) from warehouse.f_meta for 2026, grouped by vendedor, subgrupo, mes.
    # 2. Fetch realized faturamento from DWH for 2026, grouped by vendedor, subgrupo, mes.
    # 3. Join them and upsert to Supabase.
    
    # How do we map materials to subgrupos?
    # Usually: 'Dentscare', 'Home Care', 'Whiteness'.
    # In the spreadsheet, the subgrupo is derived from the product line/material.
    # Let's inspect how sync_sfmc.py or data files define materials.
    # If the subgrupo is not directly in f_meta, how is it determined?
    # Let's check d_material or similar. Or does f_meta has Sigla or Setor de Atividade?
    # In f_meta_comercial, we have: Setor de Atividade, CodRepresentante, Material.
    # Let's inspect warehouse.d_material table.
    
    conn = get_dwh_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # Let's see what materials/subgroups we have in f_meta
    cur.execute("SELECT DISTINCT \"Setor de atividade\" FROM warehouse.f_meta LIMIT 10")
    print("Setores de atividade in f_meta:", cur.fetchall())
    
    # Let's write the query to build performance 2026 directly.
    # Since we need to categorize meta and realizado by subgrupo:
    # Let's check how the spreadsheet does it.
    
    # Fetch active seller codes to filter
    csv_path = "User_Salesforce.csv"
    seller_codes = set()
    with open(csv_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            code = row.get("SellerCode__c")
            if code and code.strip():
                try:
                    seller_codes.add(int(float(code.strip())))
                except ValueError:
                    pass

    if not seller_codes:
        logger.error("No active seller codes found. Aborting performance sync.")
        return

    # Load material mapping from DWH warehouse.d_material
    material_subgroups = {}
    conn_mat = get_dwh_connection()
    cur_mat = conn_mat.cursor(cursor_factory=RealDictCursor)
    try:
        cur_mat.execute('SELECT "Material", "Subgrupo" FROM warehouse.d_material WHERE "Material" IS NOT NULL AND "Subgrupo" IS NOT NULL')
        d_mat_rows = cur_mat.fetchall()
        for r in d_mat_rows:
            code_str = str(r["Material"]).strip().lstrip("0")
            subg = str(r["Subgrupo"]).strip()
            material_subgroups[code_str] = subg
    except Exception as e:
        logger.error(f"Error loading material subgroups from DWH: {e}")
    finally:
        cur_mat.close()
        conn_mat.close()

    logger.info(f"Loaded {len(material_subgroups)} product/material mappings from DWH.")

    conn = get_dwh_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # 1. Fetch Goals (Meta) from DWH
    placeholders = ','.join(['%s'] * len(seller_codes))
    meta_query = f"""
    SELECT 
        m."CodRepresentante"::integer as vendedor_code,
        m."Mês"::integer as mes,
        m."Material SAP" as material,
        SUM(m."Valor Meta") as meta_faturamento,
        SUM(m."Qtde Meta") as meta_volume
    FROM warehouse.f_meta m
    WHERE m."Ano" = '2026'
      AND m."CodRepresentante"::bigint IN ({placeholders})
    GROUP BY m."CodRepresentante"::integer, m."Mês"::integer, m."Material SAP"
    """
    logger.info("Fetching goals/meta from DWH...")
    cur.execute(meta_query, list(seller_codes))
    meta_rows = cur.fetchall()
    logger.info(f"Retrieved {len(meta_rows)} meta rows from DWH.")

    # 2. Fetch Realizado (Billing) from DWH for 2026
    realizado_query = f"""
    SELECT 
        f."Cód. Representante Carteira"::integer as vendedor_code,
        EXTRACT(MONTH FROM f."Data Faturamento")::integer as mes,
        f."Material" as material,
        SUM(f."Valor Líquido Faturado BRL") as realizado_faturamento,
        SUM(f."Qtde Faturada") as realizado_volume
    FROM warehouse.f_ordem_faturamento_sap f
    WHERE EXTRACT(YEAR FROM f."Data Faturamento") = 2026
      AND f."Cód. Representante Carteira"::bigint IN ({placeholders})
    GROUP BY f."Cód. Representante Carteira"::integer, EXTRACT(MONTH FROM f."Data Faturamento")::integer, f."Material"
    """
    logger.info("Fetching realizado from DWH for 2026...")
    cur.execute(realizado_query, list(seller_codes))
    real_rows = cur.fetchall()
    logger.info(f"Retrieved {len(real_rows)} realizado rows from DWH.")

    # Aggregate performance by seller, subgrupo, mes
    # Key: (vendedor_code, subgrupo, mes) -> values
    perf_map = {}

    def get_perf_entry(vcode, subg, mes_val):
        k = (vcode, subg, mes_val)
        if k not in perf_map:
            perf_map[k] = {
                "vendedor_code": vcode,
                "subgrupo": subg,
                "mes": mes_val,
                "meta_faturamento": 0.0,
                "realizado_faturamento": 0.0,
                "meta_volume": 0.0,
                "realizado_volume": 0.0
            }
        return perf_map[k]

    # Process meta
    for row in meta_rows:
        vcode = row["vendedor_code"]
        mes_val = row["mes"]
        mat = str(row["material"]).strip().lstrip("0")
        subg = material_subgroups.get(mat, "Outros")
        
        entry = get_perf_entry(vcode, subg, mes_val)
        entry["meta_faturamento"] += float(row["meta_faturamento"] or 0)
        entry["meta_volume"] += float(row["meta_volume"] or 0)

    # Process realizado
    for row in real_rows:
        vcode = row["vendedor_code"]
        mes_val = row["mes"]
        mat = str(row["material"]).strip().lstrip("0")
        subg = material_subgroups.get(mat, "Outros")
        
        entry = get_perf_entry(vcode, subg, mes_val)
        entry["realizado_faturamento"] += float(row["realizado_faturamento"] or 0)
        entry["realizado_volume"] += float(row["realizado_volume"] or 0)

    # We also need seller names! Let's build a map from CSV directly for clean names
    csv_path = "User_Salesforce.csv"
    seller_names_map = {}
    with open(csv_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            code = row.get("SellerCode__c")
            name = row.get("Name")
            if code and code.strip() and name:
                try:
                    seller_names_map[int(float(code.strip()))] = name.strip().upper()
                except ValueError:
                    pass

    records = []
    for k, val in perf_map.items():
        vcode = val["vendedor_code"]
        val["vendedor_nome"] = seller_names_map.get(vcode, f"Representante {vcode}")
        records.append(val)

    logger.info(f"Upserting {len(records)} performance records to Supabase...")
    # Chunk upsert
    chunk_size = 1000
    total_upserted = 0
    for i in range(0, len(records), chunk_size):
        chunk = records[i:i+chunk_size]
        supabase_client.table("performance_vendedor_2026").upsert(
            chunk,
            on_conflict="vendedor_code,subgrupo,mes"
        ).execute()
        total_upserted += len(chunk)
        logger.info(f"Upserted {total_upserted}/{len(records)} performance records...")

    cur.close()
    conn.close()

if __name__ == "__main__":
    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables must be set.")
    else:
        # Create a custom client with SSL verification disabled due to local corporate proxy environment
        import httpx
        from supabase import ClientOptions
        
        # Configure client options with disabled verify
        options = ClientOptions(
            postgrest_client_timeout=30.0
        )
        
        # Custom HTTP Client
        http_client = httpx.Client(verify=False)
        
        # Initialize Supabase client with custom http client
        supabase: Client = create_client(
            SUPABASE_URL, 
            SUPABASE_KEY, 
            options=options
        )
        # Set custom http client on Postgrest client sessions
        supabase.postgrest.session = http_client
        
        # Override internally on the request builders
        supabase.table("usuarios").session = http_client
        supabase.table("hierarquia_vendedores").session = http_client
        supabase.table("historico_faturamento").session = http_client
        supabase.table("performance_vendedor_2026").session = http_client
        
        sync_users_and_hierarchy(supabase)
        sync_faturamento(supabase)
        sync_performance_2026(supabase)
