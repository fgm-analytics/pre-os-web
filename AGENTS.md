<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Regras de Git e Integração Contínua
Neste projeto, as operações de **commit** e **push** no GitHub devem sempre ser realizadas e validadas em conjunto com o modelo local **gemma4:e4b** via **Ollama**. Qualquer geração de mensagens de commit ou verificação antes de push deve utilizar essa configuração de modelo.

