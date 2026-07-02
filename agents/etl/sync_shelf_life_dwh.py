import os
import logging
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from supabase import create_client, Client
import httpx
from supabase import ClientOptions

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

# Load configurations
load_dotenv(r'//home//fgm/scripts//pre-os-web//.env')

# Source DB (DWH PostgreSQL)
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")

# Destination (Supabase)
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

def get_dwh_connection():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        connect_timeout=10
    )

def sync_f_shelf_life(supabase_client: Client):
    logger.info("Starting synchronization of f_shelf_life from DWH...")
    conn = get_dwh_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    query = """
    SELECT 
        "Nº do material" as produto_codigo,
        "Centro" as centro,
        "Número do lote" as lote,
        "Texto breve de material" as texto_breve_material,
        "Data de produção" as data_producao,
        "Data do vencimento" as data_vencimento,
        "Quantidade Estoque" as quantidade_estoque
    FROM warehouse.f_shelf_life
    WHERE "Data do vencimento" IS NOT NULL 
      AND "Data do vencimento" <= CURRENT_DATE + INTERVAL '14 months'
    """
    try:
        cur.execute(query)
        rows = cur.fetchall()
        logger.info(f"Retrieved {len(rows)} records from DWH warehouse.f_shelf_life.")

        deduped = {}
        for r in rows:
            if not r["produto_codigo"]:
                continue
            
            p_code = str(r["produto_codigo"]).strip()
            lote = str(r["lote"]).strip() if r["lote"] else ""
            qty = float(r["quantidade_estoque"]) if r["quantidade_estoque"] is not None else 0
            
            # Chave composta para deduplicação: produto_codigo + lote
            dedup_key = f"{p_code}_{lote}"
            
            if dedup_key not in deduped:
                deduped[dedup_key] = {
                    "produto_codigo": p_code,
                    "lote": lote,
                    "centro": str(r["centro"]).strip() if r["centro"] else None,
                    "texto_breve_material": str(r["texto_breve_material"]).strip() if r["texto_breve_material"] else None,
                    "data_producao": r["data_producao"].isoformat() if r["data_producao"] else None,
                    "data_vencimento": r["data_vencimento"].isoformat() if r["data_vencimento"] else None,
                    "quantidade_estoque": qty
                }
            else:
                # Soma a quantidade em estoque dos lotes
                deduped[dedup_key]["quantidade_estoque"] += qty
                # Mantém a data de vencimento mais próxima (menor data)
                if r["data_vencimento"] and deduped[dedup_key]["data_vencimento"]:
                    if r["data_vencimento"].isoformat() < deduped[dedup_key]["data_vencimento"]:
                        deduped[dedup_key]["data_vencimento"] = r["data_vencimento"].isoformat()
                        deduped[dedup_key]["data_producao"] = r["data_producao"].isoformat() if r["data_producao"] else None

        records = list(deduped.values())

        if records:
            # 1. Garante que todos os 'centros' existam na d_org_venda para evitar erro de Foreign Key
            unique_centros = {r["centro"] for r in records if r["centro"]}
            if unique_centros:
                centros_to_upsert = [{"centro": c, "descricao": f"Centro {c} (Auto-inserido)"} for c in unique_centros]
                try:
                    supabase_client.table("d_org_venda").upsert(centros_to_upsert, on_conflict="centro").execute()
                    logger.info(f"Upserted {len(unique_centros)} centros into d_org_venda to satisfy foreign keys.")
                except Exception as e:
                    logger.error(f"Erro ao inserir centros em d_org_venda: {e}")

            # 2. Faz o upsert dos registros na f_shelf_life
            chunk_size = 1000
            total_upserted = 0
            
            # Since f_shelf_life might have data that we want to replace completely or update,
            # and the unique constraint is on produto_codigo (as per migration 005), we can upsert by it.
            for i in range(0, len(records), chunk_size):
                chunk = records[i:i+chunk_size]
                supabase_client.table("f_shelf_life").upsert(
                    chunk,
                    on_conflict="produto_codigo, lote"
                ).execute()
                total_upserted += len(chunk)
                logger.info(f"Upserted {total_upserted}/{len(records)} f_shelf_life records...")
                
            logger.info("Synchronization of f_shelf_life completed successfully.")
        else:
            logger.warning("No valid records found to sync.")

    except Exception as e:
        logger.error(f"Error during synchronization: {e}")
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables must be set.")
    else:
        # Create a custom client with SSL verification disabled due to local corporate proxy environment
        options = ClientOptions(postgrest_client_timeout=30.0)
        http_client = httpx.Client(verify=False)
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY, options=options)
        
        # Override internally on the request builders
        supabase.postgrest.session = http_client
        supabase.table("f_shelf_life").session = http_client
        
        sync_f_shelf_life(supabase)
