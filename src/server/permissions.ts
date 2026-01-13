/**
 * Permissions Service
 * Handles user-company permission checking and management
 * Uses array-based storage for efficient permission management
 */

import { db } from "./db";
import { userCompanyPermissions, companies, users } from "./db/schema";
import { eq, sql, inArray, and } from "drizzle-orm";

/**
 * Check if a user has permission to access a specific company
 * Admin and accountant roles have access to all companies
 */
export async function hasCompanyPermission(
  userId: string,
  companyId: string
): Promise<boolean> {
  // Check user role first - admin and accountant have access to everything
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    return false;
  }

  // Admin and accountant have access to all companies
  if (user.role === "admin" || user.role === "accountant") {
    return true;
  }

  // For regular users, check if company ID is in their permissions array
  const permission = await db.query.userCompanyPermissions.findFirst({
    where: eq(userCompanyPermissions.userId, userId),
  });

  if (!permission || !permission.companyIds) {
    return false;
  }

  return permission.companyIds.includes(companyId);
}

/**
 * Get all company IDs that a user has permission to access
 * Admin and accountant get all active companies
 */
export async function getUserCompanyIds(userId: string): Promise<string[]> {
  // Check user role first
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    return [];
  }

  // Admin and accountant have access to all active companies
  if (user.role === "admin" || user.role === "accountant") {
    const allCompanies = await db.query.companies.findMany({
      where: eq(companies.active, true),
      columns: { id: true },
    });
    return allCompanies.map((c) => c.id);
  }

  // For regular users, get their permitted companies from array
  const permission = await db.query.userCompanyPermissions.findFirst({
    where: eq(userCompanyPermissions.userId, userId),
  });

  if (!permission || !permission.companyIds) {
    return [];
  }

  // Filter to only include active companies
  const activeCompanies = await db.query.companies.findMany({
    where: and(
      inArray(companies.id, permission.companyIds),
      eq(companies.active, true)
    ),
    columns: { id: true },
  });

  return activeCompanies.map((c) => c.id);
}

/**
 * Get all companies that a user has permission to access (full company objects)
 * Admin and accountant get all active companies
 */
export async function getUserCompanies(userId: string) {
  // Check user role first
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    return [];
  }

  // Admin and accountant have access to all active companies
  if (user.role === "admin" || user.role === "accountant") {
    return await db.query.companies.findMany({
      where: eq(companies.active, true),
      orderBy: (companies, { asc }) => [asc(companies.name)],
    });
  }

  // For regular users, get their permitted companies from array
  const permission = await db.query.userCompanyPermissions.findFirst({
    where: eq(userCompanyPermissions.userId, userId),
  });

  if (!permission || !permission.companyIds || permission.companyIds.length === 0) {
    return [];
  }

  // Get only active companies from the user's permission array
  return await db.query.companies.findMany({
    where: and(
      inArray(companies.id, permission.companyIds),
      eq(companies.active, true)
    ),
    orderBy: (companies, { asc }) => [asc(companies.name)],
  });
}

/**
 * Grant a user permission to access a company
 * Only admins can grant permissions
 */
export async function grantCompanyPermission(
  userId: string,
  companyId: string,
  grantedBy: string
): Promise<void> {
  // Verify the granter is an admin
  const granter = await db.query.users.findFirst({
    where: eq(users.id, grantedBy),
  });

  if (!granter || granter.role !== "admin") {
    throw new Error("Only admins can grant permissions");
  }

  // Verify the user exists and is a regular user
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.role === "admin" || user.role === "accountant") {
    throw new Error("Cannot grant permissions to admin or accountant users");
  }

  // Verify the company exists
  const company = await db.query.companies.findFirst({
    where: eq(companies.id, companyId),
  });

  if (!company) {
    throw new Error("Company not found");
  }

  // Get existing permissions
  const existing = await db.query.userCompanyPermissions.findFirst({
    where: eq(userCompanyPermissions.userId, userId),
  });

  if (existing) {
    // Check if company already in array
    if (existing.companyIds && existing.companyIds.includes(companyId)) {
      return; // Already has permission
    }

    // Add company to array
    const newCompanyIds = [...(existing.companyIds || []), companyId];
    await db
      .update(userCompanyPermissions)
      .set({ companyIds: newCompanyIds })
      .where(eq(userCompanyPermissions.userId, userId));
  } else {
    // Create new permission record with company in array
    await db.insert(userCompanyPermissions).values({
      userId,
      companyIds: [companyId],
    });
  }
}

/**
 * Revoke a user's permission to access a company
 * Only admins can revoke permissions
 */
export async function revokeCompanyPermission(
  userId: string,
  companyId: string,
  revokedBy: string
): Promise<void> {
  // Verify the revoker is an admin
  const revoker = await db.query.users.findFirst({
    where: eq(users.id, revokedBy),
  });

  if (!revoker || revoker.role !== "admin") {
    throw new Error("Only admins can revoke permissions");
  }

  // Get existing permissions
  const existing = await db.query.userCompanyPermissions.findFirst({
    where: eq(userCompanyPermissions.userId, userId),
  });

  if (!existing || !existing.companyIds) {
    return; // No permissions to revoke
  }

  // Remove company from array
  const newCompanyIds = existing.companyIds.filter((id) => id !== companyId);

  if (newCompanyIds.length === 0) {
    // Delete the record if no companies left
    await db
      .delete(userCompanyPermissions)
      .where(eq(userCompanyPermissions.userId, userId));
  } else {
    // Update with filtered array
    await db
      .update(userCompanyPermissions)
      .set({ companyIds: newCompanyIds })
      .where(eq(userCompanyPermissions.userId, userId));
  }
}

/**
 * Get all permissions for a specific user
 */
export async function getUserPermissions(userId: string) {
  const permission = await db.query.userCompanyPermissions.findFirst({
    where: eq(userCompanyPermissions.userId, userId),
  });

  if (!permission || !permission.companyIds || permission.companyIds.length === 0) {
    return [];
  }

  // Get company details for all permitted companies
  const companiesData = await db.query.companies.findMany({
    where: inArray(companies.id, permission.companyIds),
  });

  return companiesData.map((company) => ({
    companyId: company.id,
    companyName: company.name,
    companyNip: company.nip,
    companyActive: company.active,
  }));
}

/**
 * Set all permissions for a user (replaces existing permissions)
 * Only admins can set permissions
 */
export async function setUserPermissions(
  userId: string,
  companyIds: string[],
  grantedBy: string
): Promise<void> {
  // Verify the granter is an admin
  const granter = await db.query.users.findFirst({
    where: eq(users.id, grantedBy),
  });

  if (!granter || granter.role !== "admin") {
    throw new Error("Only admins can set permissions");
  }

  // Verify the user exists and is a regular user
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.role === "admin" || user.role === "accountant") {
    throw new Error("Cannot set permissions for admin or accountant users");
  }

  // Check if permission record exists
  const existing = await db.query.userCompanyPermissions.findFirst({
    where: eq(userCompanyPermissions.userId, userId),
  });

  if (companyIds.length === 0) {
    // Delete record if no companies
    if (existing) {
      await db
        .delete(userCompanyPermissions)
        .where(eq(userCompanyPermissions.userId, userId));
    }
    return;
  }

  if (existing) {
    // Update existing record
    await db
      .update(userCompanyPermissions)
      .set({ companyIds })
      .where(eq(userCompanyPermissions.userId, userId));
  } else {
    // Create new record
    await db.insert(userCompanyPermissions).values({
      userId,
      companyIds,
    });
  }
}

/**
 * Check if multiple companies are accessible by the user
 * Returns a map of companyId -> hasPermission
 */
export async function checkMultipleCompanyPermissions(
  userId: string,
  companyIds: string[]
): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();

  if (companyIds.length === 0) {
    return result;
  }

  // Check user role first
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    // User not found, no permissions
    companyIds.forEach((id) => result.set(id, false));
    return result;
  }

  // Admin and accountant have access to all companies
  if (user.role === "admin" || user.role === "accountant") {
    companyIds.forEach((id) => result.set(id, true));
    return result;
  }

  // For regular users, check their permissions array
  const permission = await db.query.userCompanyPermissions.findFirst({
    where: eq(userCompanyPermissions.userId, userId),
  });

  const permittedIds = new Set(permission?.companyIds || []);

  companyIds.forEach((id) => {
    result.set(id, permittedIds.has(id));
  });

  return result;
}
