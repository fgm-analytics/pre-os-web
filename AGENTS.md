<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Regras de Git e Integração Contínua
Neste projeto, as operações de **commit** e **push** no GitHub devem sempre ser realizadas e validadas em conjunto com o modelo **gpt-4o-mini** via **OpenAI**. Qualquer geração de mensagens de commit ou verificação antes de push deve utilizar essa configuração de modelo.

# Regras de Banco de Dados e DWH
- **Padrão de Nomenclatura:** Ao importar tabelas ou colunas provenientes do DWH (ex: `d_material`, `f_shelf_life`), é obrigatório normalizar os nomes para o formato `snake_case` (exemplo: alterar "Grupo Principal" para `grupo_principal` e "Material" para `material`). O uso de aspas duplas, espaços e caracteres especiais nos nomes das colunas (ex: `"Material"`, `"Grupo Principal"`) causa problemas de sintaxe no PostgreSQL e no Supabase PostgREST e deve ser evitado a todo custo no ODS local.
