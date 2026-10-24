import type { Database } from "./database.types";

export type { Database, Json } from "./database.types";

export type OrgRole = Database["public"]["Enums"]["org_role"];
export type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export type Invitation = Database["public"]["Tables"]["invitations"]["Row"];
