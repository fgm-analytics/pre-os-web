import * as dotenv from 'dotenv';

// Carregar .env do diretório superior
dotenv.config({ path: '../../.env' });

// Emulando o fetch
async function testSFMC() {
  const clientId = process.env.SFMC_CLIENT_ID;
  const clientSecret = process.env.SFMC_CLIENT_SECRET;
  const authUrl = process.env.SFMC_AUTH_URI || process.env.SFMC_AUTH_BASE_URL;

  console.log("Credentials:", { clientId, authUrl });

  const authRes = await fetch(`${authUrl?.replace(/\/$/, "")}/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!authRes.ok) {
    console.error("Auth falhou:", await authRes.text());
    return;
  }
  const tokenData = await authRes.json();
  console.log("Token gerado. URL REST:", tokenData.rest_instance_url);

  const deKey = "DE_f_preco_condicao";
  const restUrl = process.env.SFMC_REST_URI || tokenData.rest_instance_url;

  const res = await fetch(
    `${restUrl.replace(/\/$/, "")}/data/v1/customobjectdata/key/${deKey}/rowset?$pageSize=10&$page=1`,
    {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
    }
  );

  console.log("Status da DE:", res.status);
  const text = await res.text();
  console.log("Response:", text.substring(0, 500));
}

testSFMC();
