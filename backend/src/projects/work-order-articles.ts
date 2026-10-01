export type WorkOrderArticle = {
  code: string;
  productName: string;
  unit: string;
  price: number;
  priceWithVat: number;
};

export const WORK_ORDER_ARTICLES: readonly WorkOrderArticle[] = [
  {
    code: '10056643',
    productName: 'Čovek/sat za daljinske intervencije/održavanje',
    unit: 'kom',
    price: 1.0,
    priceWithVat: 1.2,
  },
  {
    code: '10056595',
    productName: 'Čovek/sat za intervencije/održavanje na terenu',
    unit: 'kom',
    price: 1.0,
    priceWithVat: 1.2,
  },
] as const;

const byCode = new Map(WORK_ORDER_ARTICLES.map((a) => [a.code, a]));

export function getWorkOrderArticle(code: string): WorkOrderArticle | undefined {
  return byCode.get(code.trim());
}

export function listWorkOrderArticles(): WorkOrderArticle[] {
  return [...WORK_ORDER_ARTICLES];
}
