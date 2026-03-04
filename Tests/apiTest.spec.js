// tests/api/products.spec.js
const { test, expect } = require('@playwright/test');
import { allure } from "allure-playwright";

test('API returns expected shape', async ({ request, baseURL }) => {
  const url = `${baseURL}/products/7`;
  const res = await request.get(url);

  // 1) Response sanity
  expect(res.ok()).toBeTruthy();
  expect(res.status()).toBe(200);
  const ct = res.headers()['content-type'] || '';
  expect(ct).toContain('application/json');

  // 2) Parse JSON once
  const data = await res.json();

  // 3) Pretty print for debug
  console.log('Response JSON:\n', JSON.stringify(data, null, 2));
  // 4) Optional step to log/attach
  await test.step('Preview JSON body', async () => {
    console.log('Preview:\n', JSON.stringify(data, null, 2));
    // If you want to attach into the report:
    await test.info().attach('response.json', {
      contentType: 'application/json',
      body: JSON.stringify(data, null, 2),
    });
  });

  // 5) Validate expected properties and values
  expect(data).toBeTruthy();
  expect(typeof data).toBe('object');

  // Example: expect the product to have id 7
  expect(data).toHaveProperty('id', 7);

  // 6) Extract multiple attributes
  const { id, title, price } = data;
  // Optional type checks
  expect(typeof id).toBe('number');
  expect(typeof title).toBe('string');
  expect(typeof price).toBe('number');


  // 7) Log values & create a readable step
  console.log('id:', id, 'title:', title, 'price:', price);

  await test.step(`Fields extracted -> id=${id}, title="${title}", price=${price}`, async () => {
    // mini-check inside the step if you want
    expect(id).toBe(7);
  });
  Object.entries(data).forEach(([k, v]) => allure.parameter(k, typeof v === "object" ? JSON.stringify(v) : String(v)));
});

test('API returns POST', async ({ request, baseURL }) => {
  const url = `https://api.restful-api.dev/objects`;

  const payload = {
    name: "Apple iPad Air007",
    data: {
        Generation: "4th",
        Price: "519.99",
        Capacity: "256 GB",
        refId: 16,
    }

  };

  const res = await request.post(`https://api.restful-api.dev/objects`, {
    headers: { 'Content-Type': 'application/json' },
    data: payload,
  });

  
// Accept any 2xx
  expect(res.status(), `POST failed: ${res.status()} - ${await res.text()}`)
    .toBeGreaterThanOrEqual(200);
  expect(res.status()).toBeLessThan(300);

  const created = await res.json();
  await allure.attachment('POST response', JSON.stringify(created, null, 2), 'application/json');

  // Try to get an ID from common fields
  const newId = created.id ?? created.productId ?? created.data?.id;
  console.log('Created product id:', newId, 'body:', created);


});