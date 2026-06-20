import { redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { getStaff } from "~/lib/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const staff = await getStaff(request);
  return redirect(staff ? "/dashboard" : "/login");
}
