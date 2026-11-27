import { facetRoutes } from "@/lib/facetRoutes";

export const revalidate = 3600;
export const dynamicParams = true;
const r = facetRoutes("tech");
export const generateStaticParams = r.generateStaticParams;
export const generateMetadata = r.generateMetadata;
export default r.Page;
