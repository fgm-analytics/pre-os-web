import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import fs from "fs";
import path from "path";
import { getCachedData } from "../../lib/redis";

// Ignora erros de certificado SSL (útil para redes corporativas com proxy)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Ferramentas disponíveis para o modelo
const tools = [
  {
    functionDeclarations: [
      {
        name: "get_produto_info",
        description: "Retorna o preço, desconto de segmentação e disponibilidade de um produto na tabela de preços. Pode calcular o preço final se a quantidade for fornecida.",
        parameters: {
          type: "OBJECT",
          properties: {
            produto: { type: "STRING", description: "Nome ou código do produto" },
            quantidade: { type: "INTEGER", description: "Quantidade desejada para calcular desconto" }
          },
          required: ["produto"]
        }
      },
      {
        name: "get_status_meta",
        description: "Retorna o status atual de atingimento de meta (faturamento) do vendedor no mês atual."
      },
      {
        name: "get_clientes_em_queda",
        description: "Retorna a lista de clientes ativos (compraram nos últimos 180 dias) que tiveram queda de faturamento recente."
      },
      {
        name: "get_clientes_risco_churn",
        description: "Lista clientes em risco de churn (120 a 179 dias sem compra) ou já em churn (> 180 dias sem compra).",
        parameters: {
          type: "OBJECT",
          properties: {
            tipo: { type: "STRING", description: "'risco' (120-179 dias) ou 'churn' (>180 dias)" }
          },
          required: ["tipo"]
        }
      },
      {
        name: "get_comparativo_ano_passado",
        description: "Compara as vendas e faturamento do mês atual com o mesmo mês do ano passado."
      },
      {
        name: "get_produtos_tendencia",
        description: "Lista os produtos que estão em alta ou em queda de vendas."
      },
      {
        name: "get_foco_vendas",
        description: "Sujere quais produtos ou clientes focar para bater a meta, priorizando clientes que não compraram este ano."
      },
      {
        name: "get_cliente_dias_sem_compra",
        description: "Retorna há quantos dias um cliente específico não faz compras.",
        parameters: {
          type: "OBJECT",
          properties: {
            cliente: { type: "STRING", description: "Nome do cliente" }
          },
          required: ["cliente"]
        }
      },
      {
        name: "get_segregados_info",
        description: "Retorna informações sobre um produto segregado: lote, quantidade em estoque e se está na lista.",
        parameters: {
          type: "OBJECT",
          properties: {
            produto: { type: "STRING", description: "Nome ou código do produto segregado" }
          },
          required: ["produto"]
        }
      }
    ]
  }
];

// Executa a função mapeada consultando o Supabase
async function executeTool(name: string, args: any, vendedorCode?: number | null) {
  console.log(`Executando ferramenta: ${name} com argumentos:`, args, 'para código do vendedor:', vendedorCode);
  
  if (!vendedorCode && name !== 'get_produto_info' && name !== 'get_segregados_info') {
    return { error: `Vendedor não encontrado. (vendedorCode recebido: ${vendedorCode})` };
  }

  if (name === 'get_produto_info') {
    const { produto, quantidade } = args;
    if (!produto) return { error: "Nome ou código do produto não fornecido." };
    
    let prices: any = {};
    try {
      prices = await getCachedData("tabela_precos_v2", async () => ({}));
    } catch(e) {}
    
    const dataDir = path.join(process.cwd(), "data");
    const jsonFiles = ["Dentscare.json", "Home_Care.json", "Whiteness.json"];
    let productMatch = null;
    
    for (const file of jsonFiles) {
      const p = path.join(dataDir, file);
      if (fs.existsSync(p)) {
        const items = JSON.parse(fs.readFileSync(p, "utf-8"));
        const match = items.find((i: any) => 
          String(i.codigo) === String(produto) || 
          String(i.material).toLowerCase().includes(String(produto).toLowerCase())
        );
        if (match) { productMatch = match; break; }
      }
    }
    
    if (!productMatch) return { error: "Produto não encontrado ou indisponível para venda na tabela oficial." };
    
    const cod = String(productMatch.codigo);
    const precoTabela = prices[cod] || 0;
    const desconto = Number(productMatch.segmentacao) || 0;
    const precoDental = precoTabela > 0 ? precoTabela * (1 - (desconto / 100)) : 0;
    
    const resp: any = {
      codigo: cod,
      produto: productMatch.material,
      preco_tabela: precoTabela > 0 ? `R$ ${precoTabela.toFixed(2)}` : "Indisponível",
      desconto_segmentacao: `${desconto}%`,
      preco_dental: precoDental > 0 ? `R$ ${precoDental.toFixed(2)}` : "Indisponível",
    };
    if (quantidade && quantidade > 0 && precoDental > 0) {
      resp.quantidade = quantidade;
      resp.preco_total = `R$ ${(precoDental * quantidade).toFixed(2)}`;
    }
    return resp;
  }
  
  if (name === 'get_status_meta') {
    const currentMonth = 7; 
    const { data: metas } = await supabaseAdmin.from('performance_vendedor_2026').select('meta_faturamento, realizado_faturamento').eq('vendedor_code', vendedorCode).eq('mes', currentMonth);
    let totalMeta = 0; let totalRealizado = 0;
    if (metas) {
      metas.forEach((m: any) => { totalMeta += Number(m.meta_faturamento || 0); totalRealizado += Number(m.realizado_faturamento || 0); });
    }
    const atingimento = totalMeta > 0 ? (totalRealizado / totalMeta) * 100 : 0;
    if (totalMeta === 0) return { error: "Sem meta encontrada para o mês." };
    return { 
      meta_mensal: `R$ ${totalMeta.toFixed(2)}`, 
      realizado: `R$ ${totalRealizado.toFixed(2)}`, 
      atingimento: `${atingimento.toFixed(1)}%` 
    };
  }
  
  if (name === 'get_clientes_risco_churn') {
    const tipo = args.tipo || 'risco'; // 'risco' ou 'churn'
    const diasMin = tipo === 'risco' ? 120 : 180;
    const diasMax = tipo === 'risco' ? 179 : 9999;
    
    const { data: clientes } = await supabaseAdmin.from('v_ultimos_pedidos')
      .select('cliente_nome, dias_desde_ultima_compra')
      .eq('vendedor_code', vendedorCode)
      .gte('dias_desde_ultima_compra', diasMin)
      .lte('dias_desde_ultima_compra', diasMax)
      .order('dias_desde_ultima_compra', { ascending: false }).limit(5);
    return clientes || [];
  }

  if (name === 'get_clientes_em_queda') {
    const { data: clientes } = await supabaseAdmin.from('v_hist_cliente')
      .select('cliente_nome, realizado_faturamento')
      .eq('vendedor_code', vendedorCode).eq('ano', 2026)
      .order('realizado_faturamento', { ascending: true }).limit(5);
    return clientes || [];
  }

  if (name === 'get_comparativo_ano_passado') {
    const { data: vendas2025 } = await supabaseAdmin.from('historico_faturamento').select('realizado_faturamento').eq('vendedor_code', vendedorCode).eq('ano', 2025).eq('mes', 7);
    const { data: vendas2026 } = await supabaseAdmin.from('historico_faturamento').select('realizado_faturamento').eq('vendedor_code', vendedorCode).eq('ano', 2026).eq('mes', 7);
    const calc = (arr: any[]) => arr ? arr.reduce((acc, curr) => acc + Number(curr.realizado_faturamento || 0), 0) : 0;
    const faturamento2025 = calc(vendas2025 || []);
    const faturamento2026 = calc(vendas2026 || []);
    return { faturamento_julho_2025: `R$ ${faturamento2025.toFixed(2)}`, faturamento_julho_2026: `R$ ${faturamento2026.toFixed(2)}` };
  }

  if (name === 'get_produtos_tendencia') {
    const { data: produtos } = await supabaseAdmin.from('historico_cliente_produto')
      .select('subgrupo, realizado_faturamento')
      .eq('vendedor_code', vendedorCode).eq('ano', 2026)
      .order('realizado_faturamento', { ascending: false }).limit(5);
    return produtos || [];
  }

  if (name === 'get_foco_vendas') {
    const { data: focos } = await supabaseAdmin.from('v_ultimos_pedidos')
      .select('cliente_nome, dias_desde_ultima_compra, oportunidade_recompra')
      .eq('vendedor_code', vendedorCode).eq('oportunidade_recompra', 'Sim')
      .order('dias_desde_ultima_compra', { ascending: false }).limit(5);
    return focos || [];
  }

  if (name === 'get_cliente_dias_sem_compra') {
    const { data: cliente } = await supabaseAdmin.from('v_ultimos_pedidos')
      .select('cliente_nome, dias_desde_ultima_compra')
      .eq('vendedor_code', vendedorCode).ilike('cliente_nome', `%${args.cliente}%`).limit(1);
    return cliente && cliente.length > 0 ? cliente[0] : { error: "Cliente não encontrado ou não tem histórico." };
  }

  if (name === 'get_segregados_info') {
    const { data: segregados } = await supabaseAdmin.from('f_shelf_life')
      .select('texto_breve_material, lote, quantidade_estoque')
      .ilike('texto_breve_material', `%${args.produto}%`).limit(3);
    return segregados && segregados.length > 0 ? segregados : { error: "Produto não encontrado na lista de segregados." };
  }

  return { error: "Função não encontrada" };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY não configurada no .env' });
  }

  try {
    const { messages, vendedorId, vendedorCode: vendedorCodeFromBody } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages is required and must be an array' });
    }

    // Se o frontend não enviou o código do vendedor, resolve pelo token de autenticação
    let vendedorCode: number | null = vendedorCodeFromBody ?? null;
    if (!vendedorCode) {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');
      if (token) {
        const { data: { user } } = await supabaseAdmin.auth.getUser(token);
        if (user) {
          const { data: profile } = await supabaseAdmin
            .from('usuarios')
            .select('vendedor_code')
            .eq('id', user.id)
            .single();
          if (profile?.vendedor_code) vendedorCode = profile.vendedor_code;
        }
      }
    }

    console.log('[chat.ts] vendedorCode final:', vendedorCode, '| from body:', vendedorCodeFromBody);

    // Mapeia as mensagens do formato OpenAI (do Frontend) para o formato Gemini
    const geminiMessages: any[] = messages.filter((m: any) => m.role !== 'system' && m.role !== 'tool').map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

    // O Gemini exige que a primeira mensagem do histórico (contents) seja SEMPRE do 'user'
    // Se a primeira mensagem for a saudação inicial do 'model', a API retorna Erro 400.
    while (geminiMessages.length > 0 && geminiMessages[0].role !== 'user') {
      geminiMessages.shift();
    }

    const systemInstruction = {
      parts: [{ text: `Você é um assistente de vendas de alta performance da FGM Dental Group. Ajude o vendedor a analisar sua carteira e atingir metas. Seja conciso e direto. Sempre use as ferramentas disponíveis para obter dados reais antes de responder sobre clientes ou metas.

REGRAS GERAIS:
- Você responde APENAS sobre a carteira do vendedor atual. Não responda perguntas relacionadas a outros vendedores.
- Não responda perguntas sobre assuntos não relacionados a Tabela de Preços, Performance Comercial e Segregados.
- Não invente dados caso não tenha a resposta. Se a ferramenta não retornar dados ou você não souber, informe para entrar em contato com o time de RevOps.
- Churn: Clientes acima de 180 dias sem compra.
- Risco de Churn: Clientes entre 120 e 179 dias sem compra.
- NUNCA sugira descontos sem aprovação do gerente.` }]
    };

    // Primeira chamada para a API do Gemini (Mudamos para 3.1-flash-lite que tem 1500 requisições diárias gratuitas)
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        systemInstruction,
        contents: geminiMessages,
        tools: tools
      })
    });

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Resposta não-JSON recebida da API (Possível bloqueio do Proxy Corporativo):');
      console.error(responseText.substring(0, 500) + '...');
      throw new Error('A API retornou HTML em vez de JSON. A sua rede corporativa/proxy provavelmente está bloqueando o acesso ao generativelanguage.googleapis.com.');
    }
    
    if (data.error) {
      throw new Error(data.error.message);
    }

    const responsePart = data.candidates[0].content.parts[0];

    // Se o Gemini decidiu chamar alguma ferramenta (Function Calling)
    if (responsePart.functionCall) {
      const functionName = responsePart.functionCall.name;
      const functionArgs = responsePart.functionCall.args || {};
      
      // Executa a função localmente
      const functionResult = await executeTool(functionName, functionArgs, vendedorCode);
      
      // Adiciona a resposta da IA (o pedido da chamada de função) ao histórico
      geminiMessages.push(data.candidates[0].content);
      
      // Adiciona o resultado da função ao histórico
      geminiMessages.push({
        role: "user",
        parts: [{
          functionResponse: {
            name: functionName,
            response: { result: functionResult }
          }
        }]
      });
      
      // Segunda chamada para o Gemini (para formular a resposta em texto)
      const secondResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          systemInstruction,
          contents: geminiMessages,
          tools: tools
        })
      });
      
      const secondResponseText = await secondResponse.text();
      let secondData;
      try {
        secondData = JSON.parse(secondResponseText);
      } catch (e) {
        throw new Error('A segunda chamada à API retornou HTML. (Bloqueio de Proxy)');
      }

      if (secondData.error) {
        throw new Error(secondData.error.message);
      }
      
      const finalResponseText = secondData.candidates[0].content.parts[0].text;
      
      // Devolve para o frontend no formato esperado
      return res.status(200).json({ role: 'assistant', content: finalResponseText });
    }

    // Se não chamou ferramenta, só retorna o texto
    return res.status(200).json({ role: 'assistant', content: responsePart.text });
    
  } catch (error: any) {
    console.error('Erro na API de chat (Gemini):', error);
    return res.status(500).json({ error: error.message || 'Erro interno do servidor' });
  }
}
