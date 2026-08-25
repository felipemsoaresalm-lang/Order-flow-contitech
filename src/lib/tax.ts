/**
 * Cálculo de impostos (ICMS / PIS / COFINS / IPI) a partir do preço NET unitário.
 * As fórmulas foram derivadas de planilha real de controle de vendas.
 */

export type TaxCategoryType = "industrializacao" | "consumo_garantia" | "exportacao";

export type TaxCategory = {
  code: string;
  label: string;
  tipo: TaxCategoryType;
  semBaseICMS: boolean;
  taxaPisCofins: number;
  taxaPis: number;
  taxaCofins: number;
  taxaIpi: number;
  excecaoICMS: boolean;
};

const PC = 0.0925;
const P = 0.0165;
const C = 0.076;
const IPI = 0.065;

export const categoriasFiscais: TaxCategory[] = [
  { code: "industrializacao", label: "Industrialização", tipo: "industrializacao", semBaseICMS: false, taxaPisCofins: PC, taxaPis: P, taxaCofins: C, taxaIpi: IPI, excecaoICMS: false },
  { code: "industrializacao_isento_pc_ipi", label: "Industrialização - Isento PIS/COFINS/IPI", tipo: "industrializacao", semBaseICMS: false, taxaPisCofins: 0, taxaPis: 0, taxaCofins: 0, taxaIpi: 0, excecaoICMS: false },
  { code: "industrializacao_isento_pc", label: "Industrialização - Isento PIS/COFINS", tipo: "industrializacao", semBaseICMS: false, taxaPisCofins: 0, taxaPis: 0, taxaCofins: 0, taxaIpi: IPI, excecaoICMS: false },
  { code: "industrializacao_isento_ipi", label: "Industrialização - Isento IPI", tipo: "industrializacao", semBaseICMS: false, taxaPisCofins: PC, taxaPis: P, taxaCofins: C, taxaIpi: 0, excecaoICMS: false },
  { code: "consumo", label: "Consumo", tipo: "consumo_garantia", semBaseICMS: false, taxaPisCofins: PC, taxaPis: P, taxaCofins: C, taxaIpi: IPI, excecaoICMS: false },
  { code: "consumo_isento_pc_ipi", label: "Consumo - Isento PIS/COFINS/IPI", tipo: "consumo_garantia", semBaseICMS: false, taxaPisCofins: 0, taxaPis: 0, taxaCofins: 0, taxaIpi: 0, excecaoICMS: false },
  { code: "consumo_isento_ipi", label: "Consumo - Isento IPI", tipo: "consumo_garantia", semBaseICMS: false, taxaPisCofins: PC, taxaPis: P, taxaCofins: C, taxaIpi: 0, excecaoICMS: false },
  { code: "consumo_isento_pc", label: "Consumo - Isento PIS/COFINS", tipo: "consumo_garantia", semBaseICMS: false, taxaPisCofins: 0, taxaPis: 0, taxaCofins: 0, taxaIpi: IPI, excecaoICMS: false },
  { code: "exportacao", label: "Exportação", tipo: "exportacao", semBaseICMS: false, taxaPisCofins: 0, taxaPis: 0, taxaCofins: 0, taxaIpi: 0, excecaoICMS: false },
  { code: "garantia", label: "Garantia", tipo: "consumo_garantia", semBaseICMS: false, taxaPisCofins: PC, taxaPis: P, taxaCofins: C, taxaIpi: IPI, excecaoICMS: false },
  { code: "industrializacao_sem_base_icms", label: "Industrialização - Sem PIS/COFINS na base de cálculo do ICMS", tipo: "industrializacao", semBaseICMS: true, taxaPisCofins: PC, taxaPis: P, taxaCofins: C, taxaIpi: IPI, excecaoICMS: true },
  { code: "consumo_sem_base_icms", label: "Consumo - Sem PIS/COFINS na base de cálculo do ICMS", tipo: "consumo_garantia", semBaseICMS: true, taxaPisCofins: PC, taxaPis: P, taxaCofins: C, taxaIpi: IPI, excecaoICMS: false },
  { code: "industrializacao_isento_ipi_sem_base_icms", label: "Industrialização - Isento de IPI - Sem PIS/COFINS na base de cálculo do ICMS", tipo: "industrializacao", semBaseICMS: true, taxaPisCofins: PC, taxaPis: P, taxaCofins: C, taxaIpi: 0, excecaoICMS: false },
  // Presente por completude; não utilizada atualmente.
  { code: "consumo_isento_ipi_sem_base_icms", label: "Consumo - Isento de IPI - Sem PIS/COFINS na base de cálculo do ICMS", tipo: "consumo_garantia", semBaseICMS: true, taxaPisCofins: PC, taxaPis: P, taxaCofins: C, taxaIpi: 0, excecaoICMS: false },
];

export const DEFAULT_TAX_CATEGORY = "industrializacao";
export const ICMS_RATES = [0.04, 0.07, 0.12, 0.18, 0.2];

export function findCategoria(code?: string | null) {
  return categoriasFiscais.find((c) => c.code === code);
}

export type TaxResult = {
  valorLiquidoTotal: number;
  valorICMS: number;
  valorPIS: number;
  valorCOFINS: number;
  valorIPI: number;
  valorTotalComImpostos: number;
  precoUnitarioComImpostos: number;
};

const zero = (valorLiquidoTotal: number, precoNetoUnitario: number): TaxResult => ({
  valorLiquidoTotal,
  valorICMS: 0,
  valorPIS: 0,
  valorCOFINS: 0,
  valorIPI: 0,
  valorTotalComImpostos: valorLiquidoTotal,
  precoUnitarioComImpostos: precoNetoUnitario,
});

export function calcularImpostos(params: {
  categoria: string;
  quantidade: number;
  precoNetoUnitario: number;
  aliquotaICMS: number;
}): TaxResult {
  const { quantidade, precoNetoUnitario, aliquotaICMS } = params;
  const cat = findCategoria(params.categoria);
  const valorLiquidoTotal = precoNetoUnitario * quantidade;

  if (!cat || quantidade <= 0 || !Number.isFinite(valorLiquidoTotal)) {
    return zero(valorLiquidoTotal || 0, precoNetoUnitario || 0);
  }

  const { taxaPisCofins: pc, taxaPis: p, taxaCofins: c, taxaIpi: i } = cat;

  // Grupo A — Exportação: nenhuma incidência.
  if (cat.tipo === "exportacao") return zero(valorLiquidoTotal, precoNetoUnitario);

  // Grupo B — Industrialização com PIS/COFINS na base do ICMS.
  if (cat.tipo === "industrializacao" && !cat.semBaseICMS) {
    const subtotal = valorLiquidoTotal / (1 - (pc + aliquotaICMS));
    const valorIPI = subtotal * i;
    const valorTotalComImpostos = subtotal + valorIPI;
    return {
      valorLiquidoTotal,
      valorICMS: subtotal * aliquotaICMS,
      valorPIS: subtotal * p,
      valorCOFINS: subtotal * c,
      valorIPI,
      valorTotalComImpostos,
      precoUnitarioComImpostos: valorTotalComImpostos / quantidade,
    };
  }

  // Grupo C — exceção da planilha original (ICMS sobre valor sem adicional de IPI).
  // TODO: confirmar se este cálculo de ICMS deveria seguir o padrão do Grupo D
  if (cat.excecaoICMS) {
    const subtotal = valorLiquidoTotal / ((1 - aliquotaICMS) * (1 - pc));
    const valorTotalComImpostos = subtotal * (1 + i);
    return {
      valorLiquidoTotal,
      valorICMS: subtotal * aliquotaICMS,
      valorPIS: subtotal * (1 - aliquotaICMS) * p,
      valorCOFINS: subtotal * (1 - aliquotaICMS) * c,
      valorIPI: valorTotalComImpostos - subtotal,
      valorTotalComImpostos,
      precoUnitarioComImpostos: valorTotalComImpostos / quantidade,
    };
  }

  // Grupo D — Consumo/Garantia e Industrialização "sem base" sem exceção.
  let subtotal: number;
  let valorPIS: number;
  let valorCOFINS: number;
  let valorICMS: number;
  if (cat.semBaseICMS) {
    subtotal = valorLiquidoTotal / ((1 - (1 + i) * aliquotaICMS) * (1 - pc));
    valorICMS = subtotal * (1 + i) * aliquotaICMS;
    valorPIS = (subtotal - valorICMS) * p;
    valorCOFINS = (subtotal - valorICMS) * c;
  } else {
    subtotal = valorLiquidoTotal / (1 - (1 + i) * aliquotaICMS - pc);
    valorICMS = subtotal * (1 + i) * aliquotaICMS;
    valorPIS = subtotal * p;
    valorCOFINS = subtotal * c;
  }
  const valorTotalComImpostos = subtotal * (1 + i);
  return {
    valorLiquidoTotal,
    valorICMS,
    valorPIS,
    valorCOFINS,
    valorIPI: valorTotalComImpostos - subtotal,
    valorTotalComImpostos,
    precoUnitarioComImpostos: valorTotalComImpostos / quantidade,
  };
}

export function sumTaxResults(list: TaxResult[]): TaxResult {
  const acc = list.reduce<TaxResult>(
    (a, r) => ({
      valorLiquidoTotal: a.valorLiquidoTotal + r.valorLiquidoTotal,
      valorICMS: a.valorICMS + r.valorICMS,
      valorPIS: a.valorPIS + r.valorPIS,
      valorCOFINS: a.valorCOFINS + r.valorCOFINS,
      valorIPI: a.valorIPI + r.valorIPI,
      valorTotalComImpostos: a.valorTotalComImpostos + r.valorTotalComImpostos,
      precoUnitarioComImpostos: 0,
    }),
    zero(0, 0),
  );
  return acc;
}
