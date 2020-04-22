
import * as Handlebars from "handlebars";
import { CodeDict, TestSpec, StringDict } from "./types";
import { isEmptyObject, jsToCode } from "./utils";
import { TestContext } from "./testContext";

export class GlobalContext {
    handlebarsEnv = Handlebars.create();

    globalHelpers?: CodeDict;
    globalPartials?: StringDict;
    globalDecorators?: CodeDict;

    afterFns: Function[] = [];
    beforeFns: Function[] = [];
    descriptionStack: string[] = [];

    testContext: TestContext = new TestContext();

    indices: StringDict = {};
    oldIndices: StringDict = {};
    suite: string = "";
    unusedPatches: StringDict = {};
    tests: TestSpec[] = [];

    detectGlobals() {
        this.detectGlobalHelpers();
        this.detectGlobalPartials();
        this.detectGlobalDecorators();
    }

    private detectGlobalHelpers() {
        let { handlebarsEnv } = this;
        const builtins = [
            'helperMissing', 'blockHelperMissing', 'each', 'if',
            'unless', 'with', 'log', 'lookup'
        ];
        let globalHelpers: CodeDict = {};

        Object.keys(handlebarsEnv.helpers).forEach((x) => {
            if (builtins.indexOf(x) !== -1) {
                return;
            }
            globalHelpers[x] = jsToCode(handlebarsEnv.helpers[x]);
        });

        this.globalHelpers = isEmptyObject(globalHelpers) ? undefined : globalHelpers;
    }

    private detectGlobalDecorators() {
        let { handlebarsEnv } = this;
        const builtins = ['inline'];
        let globalDecorators: CodeDict = {};

        Object.keys(handlebarsEnv.decorators).forEach((x) => {
            if (builtins.indexOf(x) !== -1) {
                return;
            }
            globalDecorators[x] = jsToCode(handlebarsEnv.decorators[x]);
        });

        this.globalDecorators = isEmptyObject(globalDecorators) ? undefined : globalDecorators;
    }

    private detectGlobalPartials() {
        let { handlebarsEnv } = this;
        // This should never be null, but it is in one case
        if (!handlebarsEnv) {
            return;
        }

        let globalPartials: StringDict = {};

        Object.keys(handlebarsEnv.partials).forEach((x) => {
            globalPartials[x] = handlebarsEnv.partials[x];
        });

        this.globalPartials = isEmptyObject(globalPartials) ? undefined : globalPartials;
    }
}
