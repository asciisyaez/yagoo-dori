import { permanentRedirect } from "next/navigation";

export default function LeadersRedirectPage() {
  permanentRedirect("/cards?view=outfits");
}
