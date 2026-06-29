import requests
import json
from sync_sfmc import (
    get_sfmc_token,
    SFMC_REST_URL,
    SFMC_DATA_EXTENSION_ID_SHELF_LIFE,
    SFMC_DATA_EXTENSION_ID_PRECO,
    logger
)

def test_sync_insert_shelf_life(token):
    url = f"{SFMC_REST_URL}/data/v1/customobjectdata/key:{SFMC_DATA_EXTENSION_ID_SHELF_LIFE}/rowset"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Payload simulado para f_shelf_life
    payload = [
        {
            "keys": {
                "produto_codigo": "TESTE123",
                "centro": "1000"
            },
            "values": {
                "data_producao": "2026-06-25",
                "texto_breve_material": "Produto Teste",
                "data_vencimento": "2026-12-31",
                "quantidade_estoque": "10.50"
            }
        }
    ]
    
    print("Enviando teste síncrono para f_shelf_life...")
    response = requests.post(url, headers=headers, json=payload, verify=False)
    print(f"Status f_shelf_life: {response.status_code}")
    print(f"Response: {response.text}\n")


def test_sync_insert_preco(token):
    url = f"{SFMC_REST_URL}/data/v1/customobjectdata/key:{SFMC_DATA_EXTENSION_ID_PRECO}/rowset"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Payload simulado para f_preco_condicao
    payload = [
        {
            "keys": {
                "ov": "OV123",
                "item_ov": "10"
            },
            "values": {
                "preco_zpr0": "99.99",
                "cod_tipo_list_precos": "Z3"
            }
        }
    ]
    
    print("Enviando teste síncrono para f_preco_condicao...")
    response = requests.post(url, headers=headers, json=payload, verify=False)
    print(f"Status f_preco_condicao: {response.status_code}")
    print(f"Response: {response.text}\n")


if __name__ == "__main__":
    token = get_sfmc_token()
    test_sync_insert_shelf_life(token)
    test_sync_insert_preco(token)
