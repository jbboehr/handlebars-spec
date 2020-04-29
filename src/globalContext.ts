
import { TestContext } from './testContext';

export class GlobalContext {
    afterFns: Function[] = [];
    beforeFns: Function[] = [];
    descriptionStack: string[] = [];

    testContext: TestContext = new TestContext();

    indices: StringDict = {};
    suite = '';
    unusedPatches: StringDict = {};
    tests: TestSpec[] = [];
    isParser?: true;
}
