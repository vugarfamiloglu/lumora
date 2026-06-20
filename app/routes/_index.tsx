import { redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { getStaff } from "~/lib/session.server";
import { homePath } from "~/lib/rbac.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const staff = await getStaff(request);
  return redirect(staff ? homePath(staff.role) : "/login");
}
