from sync_sfmc import get_db_connection

def print_columns(table_name):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(f"SELECT * FROM warehouse.{table_name} LIMIT 0")
    col_names = [desc[0] for desc in cur.description]
    print(f"Colunas da tabela {table_name}:")
    for col in col_names:
        print(f"  - '{col}'")
    cur.close()
    conn.close()

if __name__ == "__main__":
    print_columns('f_preco_condicao')
    print("\n----------------\n")
    print_columns('f_ordem_faturamento')
