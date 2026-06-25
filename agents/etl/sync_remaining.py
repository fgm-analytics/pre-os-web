import logging
import sys

# Importar as funções e dependências já prontas do script principal
from sync_sfmc import (
    get_sfmc_token,
    clear_data_extension,
    fetch_simple_table,
    sync_data,
    format_shelf_life,
    format_preco,
    format_ordem_fat_full,
    SFMC_DATA_EXTENSION_ID_SHELF_LIFE,
    SFMC_DATA_EXTENSION_ID_PRECO,
    SFMC_DATA_EXTENSION_ID_ORDEM_FATURAMENTO,
    logger
)

def process_remaining():
    try:
        logger.info("Autenticando no SFMC...")
        token = get_sfmc_token()
        
        # 6. Sincronizar f_shelf_life
        logger.info("=== Iniciando Sincronização f_shelf_life ===")
        clear_data_extension(token, SFMC_DATA_EXTENSION_ID_SHELF_LIFE)
        shelf_records = fetch_simple_table('f_shelf_life', ['Nº do material', 'Centro', 'Texto breve de material', 'Data de produção', 'Data do vencimento', 'Quantidade Estoque'])
        token = sync_data("f_shelf_life", shelf_records, format_shelf_life, SFMC_DATA_EXTENSION_ID_SHELF_LIFE, token)

        # 7. Sincronizar f_preco_condicao (Apenas Z3)
        logger.info("=== Iniciando Sincronização f_preco_condicao ===")
        clear_data_extension(token, SFMC_DATA_EXTENSION_ID_PRECO)
        preco_records = fetch_simple_table('f_preco_condicao', ['OV', 'Item OV', 'Preço ZPR0', 'Cód. Tipo Lista Preços (ZPR0)'])
        def format_preco_z3(records):
            return format_preco([r for r in records if r.get('Cód. Tipo Lista Preços (ZPR0)') == 'Z3'])
        token = sync_data("f_preco_condicao", preco_records, format_preco_z3, SFMC_DATA_EXTENSION_ID_PRECO, token)

        # 8. Sincronizar f_ordem_faturamento_full
        logger.info("=== Iniciando Sincronização f_ordem_faturamento ===")
        clear_data_extension(token, SFMC_DATA_EXTENSION_ID_ORDEM_FATURAMENTO)
        ordf_records = fetch_simple_table('f_ordem_faturamento', ['Chave Representante OV', 'Material'])
        token = sync_data("f_ordem_faturamento", ordf_records, format_ordem_fat_full, SFMC_DATA_EXTENSION_ID_ORDEM_FATURAMENTO, token)

    except Exception as e:
        logger.error(f"Falha na sincronização parcial: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    logger.info("--- Iniciando Job de Integração Parcial (Tabelas Restantes) ---")
    process_remaining()
    logger.info("--- Integração Parcial Finalizada! ---")
