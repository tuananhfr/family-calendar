import { describe, expect, it } from "vitest";
import { RESOURCE_TYPES } from "../sync/resource-types";
import { RESOURCE_SCHEMAS } from "./resource-schemas";
import { baseFields } from "../test-support/records";

describe("RESOURCE_SCHEMAS", () => {
  it("has one schema per resource type", () => {
    expect(Object.keys(RESOURCE_SCHEMAS).sort()).toEqual([...RESOURCE_TYPES].sort());
  });

  it("every schema rejects a bare base record missing its own fields", () => {
    for (const type of RESOURCE_TYPES) {
      expect(RESOURCE_SCHEMAS[type].safeParse(baseFields()).success, type).toBe(false);
    }
  });

  it("every schema rejects a record without base columns", () => {
    for (const type of RESOURCE_TYPES) {
      expect(RESOURCE_SCHEMAS[type].safeParse({}).success, type).toBe(false);
    }
  });
});
