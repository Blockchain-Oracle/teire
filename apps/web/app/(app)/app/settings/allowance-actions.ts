"use server";
import { revalidatePath } from "next/cache";
import { gateway } from "@/lib/gateway";
import { isOperator } from "@/lib/operator";
import { getSession } from "@/lib/session";

/** Teire's own end-user ids only: a person, an installation, or one of Teire's shared ones. */
const ID = /^(gh:\d+|inst:\d+|teire:[a-z-]+)$/;

async function operatorRest() {
  const session = await getSession();
  if (!session || !(await isOperator(session.user.id))) throw new Error("Only Teire's operator can do this");
  return (await gateway().as(null)).rest;
}

/** Put an end user on another of the key's budgets on Otari (raise, lower, or the demo walk's tiny budget). */
export async function moveAllowance(form: FormData) {
  const externalId = String(form.get("endUser") ?? "");
  const budgetId = String(form.get("budget") ?? "");
  if (!ID.test(externalId) || !budgetId) throw new Error("Pick an end user and a budget");
  const rest = await operatorRest();
  await rest.putEndUser(externalId, budgetId);
  revalidatePath("/app/settings/allowances");
}

/** Pause an end user on Otari, or let it work again. */
export async function pauseAllowance(form: FormData) {
  const externalId = String(form.get("endUser") ?? "");
  if (!ID.test(externalId)) throw new Error("Unknown end user");
  const rest = await operatorRest();
  await rest.blockEndUser(externalId, form.get("blocked") === "true");
  revalidatePath("/app/settings/allowances");
}
