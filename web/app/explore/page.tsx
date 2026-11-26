import { redirect } from "next/navigation";

// Explore was merged into Sites (27 Nov 2026); technologies have their own Tech section.
export default function Explore() {
  redirect("/sites");
}
