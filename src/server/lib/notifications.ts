import { db } from "@/server/db";
import { notifications } from "@/server/db/schema";
import type { NotificationType } from "@/server/db/schema";

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  invoiceId?: string;
  companyId?: string;
}

export async function createNotification(input: CreateNotificationInput) {
  const [notification] = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      invoiceId: input.invoiceId,
      companyId: input.companyId,
    })
    .returning();

  return notification;
}

export async function notifyInvoiceAccepted(
  userId: string,
  invoiceNumber: string,
  invoiceId: string
) {
  return createNotification({
    userId,
    type: "invoice_accepted",
    title: "Faktura zaakceptowana",
    message: `Twoja faktura ${invoiceNumber} została zaakceptowana przez księgowego.`,
    invoiceId,
  });
}

export async function notifyInvoiceRejected(
  userId: string,
  invoiceNumber: string,
  invoiceId: string,
  reason: string
) {
  return createNotification({
    userId,
    type: "invoice_rejected",
    title: "Faktura odrzucona",
    message: `Twoja faktura ${invoiceNumber} została odrzucona. Powód: ${reason}`,
    invoiceId,
  });
}

export async function notifyInvoiceSubmitted(
  accountantIds: string[],
  invoiceNumber: string,
  invoiceId: string,
  userName: string
) {
  const promises = accountantIds.map((accountantId) =>
    createNotification({
      userId: accountantId,
      type: "invoice_submitted",
      title: "Nowa faktura do weryfikacji",
      message: `Użytkownik ${userName} przesłał fakturę ${invoiceNumber} do weryfikacji.`,
      invoiceId,
    })
  );

  return Promise.all(promises);
}

export async function notifyInvoiceAssigned(
  accountantId: string,
  invoiceNumber: string,
  invoiceId: string
) {
  return createNotification({
    userId: accountantId,
    type: "invoice_assigned",
    title: "Przypisano fakturę",
    message: `Została Ci przypisana faktura ${invoiceNumber} do weryfikacji.`,
    invoiceId,
  });
}

export async function notifyInvoiceReReview(
  userId: string,
  invoiceNumber: string,
  invoiceId: string
) {
  return createNotification({
    userId,
    type: "invoice_re_review",
    title: "Faktura wymaga ponownej weryfikacji",
    message: `Twoja faktura ${invoiceNumber} wymaga dodatkowej weryfikacji przez księgowego.`,
    invoiceId,
  });
}

export async function notifyCompanyUpdated(
  userId: string,
  companyName: string,
  companyId: string
) {
  return createNotification({
    userId,
    type: "company_updated",
    title: "Dane firmy zaktualizowane",
    message: `Dane firmy ${companyName} zostały zaktualizowane.`,
    companyId,
  });
}

export async function notifyPasswordChanged(userId: string) {
  return createNotification({
    userId,
    type: "password_changed",
    title: "Hasło zmienione",
    message: "Twoje hasło zostało pomyślnie zmienione. Jeśli to nie Ty, natychmiast skontaktuj się z administratorem.",
  });
}
