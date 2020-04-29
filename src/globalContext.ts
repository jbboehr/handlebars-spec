
import { TestSpec, StringDict } from "./types";
import { TestContext } from "./testContext";

export class GlobalContext {
    afterFns: Function[] = [];
    beforeFns: Function[] = [];
    descriptionStack: string[] = [];

    testContext: TestContext = new TestContext();

    indices: StringDict = {};
    suite: string = "";
    unusedPatches: StringDict = {};
    tests: TestSpec[] = [];
}
