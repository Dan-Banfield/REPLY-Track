import type { SubjectDefinition, SubjectId } from "./types";

/**
 * Subject registry. To add a subject, add an entry with exactly six stats.
 * Keywords are lowercase; multi-word phrases are allowed and score higher.
 */
export const SUBJECTS: Record<SubjectId, SubjectDefinition> = {
  maths: {
    id: "maths",
    label: "Mathematics",
    stats: [
      {
        id: "algebra",
        label: "Algebra",
        description: "Equations, polynomials, functions, groups and rings.",
        color: "#e4572e",
        keywords: [
          "algebra", "equation", "polynomial", "quadratic", "factor", "factorise",
          "factorize", "simplify", "expand", "inequality", "logarithm", "log",
          "exponent", "indices", "surd", "function", "inverse function", "group",
          "ring", "field", "variable", "solve for", "roots", "simultaneous",
        ],
      },
      {
        id: "calculus",
        label: "Calculus",
        description: "Limits, derivatives, integrals, series and differential equations.",
        color: "#f3a712",
        keywords: [
          "calculus", "derivative", "differentiate", "differentiation", "integral",
          "integrate", "integration", "limit", "chain rule", "product rule",
          "quotient rule", "taylor", "maclaurin", "series", "converge", "convergence",
          "differential equation", "ode", "pde", "gradient", "rate of change",
          "partial derivative", "by parts", "substitution",
        ],
      },
      {
        id: "geometry",
        label: "Geometry",
        description: "Shapes, trigonometry, vectors in space, coordinate geometry.",
        color: "#a8c686",
        keywords: [
          "geometry", "triangle", "circle", "angle", "trigonometry", "trig", "sine",
          "cosine", "tangent", "sin", "cos", "tan", "pythagoras", "area", "volume",
          "perimeter", "polygon", "radius", "circumference", "congruent", "similar",
          "coordinate", "parabola", "ellipse", "hyperbola", "conic",
        ],
      },
      {
        id: "discrete",
        label: "Discrete",
        description: "Logic, sets, combinatorics, graph theory, number theory, proofs.",
        color: "#669bbc",
        keywords: [
          "discrete", "graph theory", "graph", "vertex", "vertices", "edge", "tree",
          "combinatorics", "permutation", "combination", "choose", "pigeonhole",
          "induction", "proof", "logic", "truth table", "boolean", "set", "subset",
          "relation", "bijection", "modular", "modulo", "mod", "prime", "gcd",
          "number theory", "recurrence", "counting", "proposition", "predicate",
        ],
      },
      {
        id: "probability",
        label: "Probability & Stats",
        description: "Probability, distributions, inference and data.",
        color: "#7b2d26",
        keywords: [
          "probability", "statistics", "stats", "random", "distribution", "normal",
          "binomial", "poisson", "mean", "median", "mode", "variance",
          "standard deviation", "expected value", "expectation", "bayes",
          "conditional probability", "hypothesis", "p-value", "regression",
          "correlation", "sample", "confidence interval", "dice", "coin",
        ],
      },
      {
        id: "linear_algebra",
        label: "Linear Algebra",
        description: "Vectors, matrices, linear maps, eigenvalues.",
        color: "#3c1642",
        keywords: [
          "linear algebra", "matrix", "matrices", "vector", "determinant",
          "eigenvalue", "eigenvector", "eigen", "basis", "span", "dimension",
          "linear independence", "linearly independent", "rank", "null space",
          "kernel", "transpose", "inverse matrix", "dot product", "cross product",
          "linear transformation", "linear map", "orthogonal", "diagonalise",
          "diagonalize",
        ],
      },
    ],
  },
};

export const DEFAULT_SUBJECT: SubjectId = "maths";

export function getSubject(id: SubjectId): SubjectDefinition {
  const subject = SUBJECTS[id];
  if (!subject) {
    throw new StatsError(`Unknown subject "${id}"`, 400);
  }
  return subject;
}

export function listSubjects(): SubjectDefinition[] {
  return Object.values(SUBJECTS);
}

export function isStatOf(subject: SubjectDefinition, statId: string): boolean {
  return subject.stats.some((s) => s.id === statId);
}

/** Error type carrying an HTTP status so route handlers can map it directly. */
export class StatsError extends Error {
  constructor(
    message: string,
    public status: number = 400,
  ) {
    super(message);
    this.name = "StatsError";
  }
}
