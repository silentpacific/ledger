import { facetRoutes, type FacetProps } from "@/lib/facetRoutes";

export const revalidate = 3600;
export const dynamicParams = true;
const r = facetRoutes("platform");
export const generateStaticParams = r.generateStaticParams;
export const generateMetadata = (p: FacetProps) => r.generateMetadata(p);
export default function Page(p: FacetProps) { return r.Page(p); }
