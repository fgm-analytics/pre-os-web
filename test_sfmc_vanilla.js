const fs = require('fs');

async function run() {
  const tokenUrl = process.env.SFMC_AUTH_URI.replace(/\/$/, "") + '/v2/token';
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: process.env.SFMC_CLIENT_ID,
      client_secret: process.env.SFMC_CLIENT_SECRET,
    }),
  });
  
  if (!res.ok) {
    console.log("Token error", res.status);
    return;
  }
  
  const tokenData = await res.json();
  const restUrl = process.env.SFMC_REST_URI || tokenData.rest_instance_url;
  const deKey = "DE_PricebookZ3";

  const resData = await fetch(
    `${restUrl.replace(/\/$/, "")}/data/v1/customobjectdata/key/${deKey}/rowset?$pageSize=10`,
    {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!resData.ok) {
    console.log("Data fetch failed", resData.status);
    return;
  }
  const data = await resData.json();
  console.log("Total items returned:", data.items?.length);
  if (data.items && data.items.length > 0) {
    console.log("First item keys:", JSON.stringify(data.items[0].keys));
    console.log("First item values:", JSON.stringify(data.items[0].values));
  }
}

run();
