import { DEFAULT_BRAND, type Brand } from "@/lib/types";
export const mergeBrandForDev = (b: Partial<Brand>): Brand => ({ ...DEFAULT_BRAND, ...b, colors: { ...DEFAULT_BRAND.colors, ...(b.colors ?? {}) } });
