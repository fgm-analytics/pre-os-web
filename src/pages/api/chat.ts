import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../lib/supabaseAdmin';

// Ignora erros de certificado SSL (útil para redes corporativas com proxy)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Ferramentas disponíveis para o modelo
const tools = [
  {
    functionDeclarations: [
      {
        name: "get_clientes_em_queda",
        description: "Retorna a lista de clientes que tiveram queda de faturamento ou faturamento mais baixo no ano.",
        parameters: {
          type: "OBJECT",
          properties: {},
        }
      },
      {
        name: "get_status_meta",
        description: "Retorna o status atual de atingimento de meta do vendedor no mês atual."
      },
      {
        name: "get_clientes_risco_churn",
        description: "Retorna a lista de clientes que não compram há um certo número de dias.",
        parameters: {
          type: "OBJECT",
          properties: {
            dias: {
              type: "INTEGER",
              description: "Número de dias sem compra (ex: 90)"
            }
          },
          required: ["dias"]
        }
      }
    ]
  }
];

// Executa a função mapeada consultando o Supabase
async function executeTool(name: string, args: any, vendedorId?: string) {
  console.log(`Executando ferramenta: ${name} com argumentos:`, args, 'para vendedor:', vendedorId);
  
  let vendedorCode = null;
  if (vendedorId) {
    const { data: vData } = await supabaseAdmin
      .from('v_vendedores_ativos')
      .select('vendedor_code')
      .eq('vendedor_nome', vendedorId)
      .limit(1)
      .single();
    if (vData) vendedorCode = vData.vendedor_code;
  }

  if (name === 'get_status_meta') {
    // O mock foca em julho de 2026, vamos pegar o mês 7
    const currentMonth = 7; 
    
    if (!vendedorCode) return { error: "Vendedor não encontrado no banco de dados." };

    const { data: metas } = await supabaseAdmin
      .from('performance_vendedor_2026')
      .select('meta_faturamento, realizado_faturamento')
      .eq('vendedor_code', vendedorCode)
      .eq('mes', currentMonth);

    let totalMeta = 0;
    let totalRealizado = 0;
    
    if (metas) {
      metas.forEach((m: any) => {
        totalMeta += Number(m.meta_faturamento || 0);
        totalRealizado += Number(m.realizado_faturamento || 0);
      });
    }
    
    const atingimento = totalMeta > 0 ? (totalRealizado / totalMeta) * 100 : 0;
    
    return { 
      meta_mensal: `R$ ${totalMeta.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 
      realizado: `R$ ${totalRealizado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 
      atingimento: `${atingimento.toFixed(1)}%`,
      status: atingimento >= 100 ? "Meta Batida!" : (atingimento > 80 ? "Na média" : "Abaixo do esperado")
    };
  }
  
  if (name === 'get_clientes_risco_churn') {
    const dias = args.dias || 90;
    if (!vendedorCode) return { error: "Vendedor não encontrado no banco de dados." };

    const { data: clientes } = await supabaseAdmin
      .from('v_ultimos_pedidos')
      .select('cliente_nome, dias_desde_ultima_compra, oportunidade_recompra')
      .eq('vendedor_code', vendedorCode)
      .gte('dias_desde_ultima_compra', dias)
      .order('dias_desde_ultima_compra', { ascending: false })
      .limit(5);

    return clientes || [];
  }

  if (name === 'get_clientes_em_queda') {
    if (!vendedorCode) return { error: "Vendedor não encontrado no banco de dados." };

    const { data: clientes } = await supabaseAdmin
      .from('v_hist_cliente')
      .select('cliente_nome, realizado_faturamento')
      .eq('vendedor_code', vendedorCode)
      .eq('ano', 2026)
      .order('realizado_faturamento', { ascending: true })
      .limit(5);

    return clientes || [];
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
    const { messages, vendedorId } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages is required and must be an array' });
    }

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
      parts: [{ text: 'Você é um assistente de vendas de alta performance da FGM Dental Group. Ajude o vendedor a analisar sua carteira e atingir metas. Seja conciso e direto. Sempre use as ferramentas disponíveis para obter dados reais antes de responder sobre clientes ou metas.' }]
    };

    // Primeira chamada para a API do Gemini
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
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
      const functionResult = await executeTool(functionName, functionArgs, vendedorId);
      
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
      const secondResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
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
