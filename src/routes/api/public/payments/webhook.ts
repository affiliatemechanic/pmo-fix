import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhook, gatewayFetch, EventName, type PaddleEnv } from "@/lib/paddle.server";
import { addSubscriber, getListIdForProduct } from "@/lib/aweber.server";

async function fetchProductExternalId(env: PaddleEnv, paddleProductId: string): Promise<string | null> {
  const res = await gatewayFetch(env, `/products/${paddleProductId}`);
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data?.import_meta?.external_id ?? json?.data?.importMeta?.externalId ?? null;
}

async function fetchCustomer(env: PaddleEnv, customerId: string): Promise<{ email: string; name?: string } | null> {
  const res = await gatewayFetch(env, `/customers/${customerId}`);
  if (!res.ok) return null;
  const json = await res.json();
  return {
    email: json?.data?.email,
    name: json?.data?.name ?? undefined,
  };
}

async function handleTransactionCompleted(data: any, env: PaddleEnv) {
  const customerId: string | undefined = data.customerId;
  const items: any[] = data.items ?? [];
  if (!customerId || items.length === 0) {
    console.warn("payments-webhook: missing customerId or items");
    return;
  }

  const customer = await fetchCustomer(env, customerId);
  if (!customer?.email) {
    console.warn("payments-webhook: customer email not found", { customerId });
    return;
  }

  // Collect unique product external_ids across all items
  const productExternalIds = new Set<string>();
  for (const item of items) {
    // Try direct first (subscription events would have it on item.product)
    const direct =
      item?.product?.importMeta?.externalId ??
      item?.product?.import_meta?.external_id ??
      null;
    if (direct) {
      productExternalIds.add(direct);
      continue;
    }
    // Transaction events: only price is included; fetch the product
    const paddleProductId: string | undefined = item?.price?.productId ?? item?.price?.product_id;
    if (paddleProductId) {
      const external = await fetchProductExternalId(env, paddleProductId);
      if (external) productExternalIds.add(external);
    }
  }

  for (const productId of productExternalIds) {
    const mapping = await getListIdForProduct(productId);
    if (!mapping) {
      console.log(`payments-webhook: no AWeber list mapped for product ${productId}`);
      continue;
    }
    const result = await addSubscriber({
      listId: mapping.listId,
      email: customer.email,
      name: customer.name,
      tags: mapping.tag ? [mapping.tag] : undefined,
    });
    console.log("payments-webhook: aweber subscribe", {
      productId,
      listId: mapping.listId,
      tag: mapping.tag,
      email: customer.email,
      ok: result.ok,
      status: result.status,
    });
  }
}

async function handleWebhook(req: Request, env: PaddleEnv) {
  const event = await verifyWebhook(req, env);

  switch (event.eventType) {
    case EventName.TransactionCompleted:
      await handleTransactionCompleted(event.data, env);
      break;
    default:
      console.log("payments-webhook: unhandled event", event.eventType);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const env = (url.searchParams.get("env") || "sandbox") as PaddleEnv;
        try {
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error("payments-webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
