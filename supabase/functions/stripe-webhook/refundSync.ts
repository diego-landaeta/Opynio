// Reembolsos hechos en Stripe (charge.refunded): qué hacer con la suscripcion a la que pertenece el cobro.
//
// Un reembolso por si solo NO cancela la suscripcion en Stripe: si se devuelve el dinero y la suscripcion sigue
// viva, se vuelve a cobrar en la siguiente renovacion y el cliente conserva el plan. Esta logica decide, sin
// efectos secundarios (se prueba aparte), si el reembolso se anota, se avisa o se cancela.

export type RefundAction = "ignore" | "record" | "alert" | "cancel";

export interface RefundContext {
  /** Importe del cobro y lo reembolsado, en la unidad menor (centimos). */
  chargeAmount: number;
  amountRefunded: number;
  /** Factura del cobro y suscripcion de esa factura; null si el cobro no es de una suscripcion. */
  invoiceId: string | null;
  subscriptionId: string | null;
  /** Estado REAL de la suscripcion en Stripe (null si ya no existe) y su ultima factura. */
  subscriptionStatus: string | null;
  latestInvoiceId: string | null;
  /** Si esta activada la cancelacion automatica (secreto REFUND_AUTO_CANCEL=true). */
  autoCancel: boolean;
}

/** Estados en los que Stripe sigue (o seguira) cobrando. */
export const BILLING_STATUSES = ["active", "trialing", "past_due"] as const;

export function isFullRefund(chargeAmount: number, amountRefunded: number): boolean {
  return chargeAmount > 0 && amountRefunded >= chargeAmount;
}

/**
 * - ignore: el cobro no es de una suscripcion (pago suelto): no hay nada que sincronizar.
 * - record: se anota (reembolso parcial, de una factura antigua o de una suscripcion que ya no cobra).
 * - alert:  reembolso TOTAL de la ultima factura de una suscripcion que sigue viva: se anota y Pagos avisa.
 * - cancel: lo mismo, con la cancelacion automatica activada: se cancela la suscripcion en Stripe.
 */
export function decideRefundAction(c: RefundContext): RefundAction {
  if (!c.invoiceId || !c.subscriptionId) return "ignore";
  if (!isFullRefund(c.chargeAmount, c.amountRefunded)) return "record";
  const viva = c.subscriptionStatus !== null && (BILLING_STATUSES as readonly string[]).includes(c.subscriptionStatus);
  if (!viva) return "record";
  if (!c.latestInvoiceId || c.latestInvoiceId !== c.invoiceId) return "record";
  return c.autoCancel ? "cancel" : "alert";
}

/** Valor de stripe_refunds.action para lo que se hizo (la cancelacion se marca al terminar con exito). */
export function storedAction(a: RefundAction, cancelled: boolean): "recorded" | "alert" | "cancelled" {
  if (a === "cancel") return cancelled ? "cancelled" : "alert";
  if (a === "alert") return "alert";
  return "recorded";
}
