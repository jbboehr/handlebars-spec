
import { CodeDict, StringDict } from "./types";
import { jsToCode } from "./utils";
import { isFunction } from "util";

export class TestContext {
    template?: string;
    data?: any;
    options?: any;
    compileOptions?: {[key: string]: any}; // Handlebars.CompileOptions
    helpers?: CodeDict;
    partials?: StringDict;
    decorators?: CodeDict;
    globalHelpers?: CodeDict;
    globalPartials?: StringDict;
    globalDecorators?: CodeDict;
    exception?: boolean;

    extraEquals?: any[];

    // these are copied from globalContext
    description?: string;
    oldDescription?: string;
    it?: string;
    key?: string;

    mergeHelpers(data: any): CodeDict | undefined {
        if (!data || typeof data !== 'object') {
            return this.helpers;
        }

        Object.keys(data).forEach((key) => {
            if (isFunction(data[key])) {
                if (!this.helpers) {
                    this.helpers = {};
                }
                this.helpers[key] = jsToCode(data[key]);
            }
        });

        return this.helpers;
    }

    mergePartials(data: any): StringDict | undefined {
        if (!data || typeof data !== 'object') {
            return this.partials;
        }

        Object.keys(data).forEach((key) => {
            if (!this.partials) {
                this.partials = {};
            }
            this.partials[key] = data[key];
        });

        return this.partials;
    }

    mergeDecorators(data: any): CodeDict | undefined {
        if (!data || typeof data !== 'object') {
            return this.decorators;
        }

        Object.keys(data).forEach((key) => {
            if (isFunction(data[key])) {
                if (!this.decorators) {
                    this.decorators = {};
                }
                this.decorators[key] = jsToCode(data[key]);
            }
        });

        return this.decorators;
    }

    reset() {
        let self = new TestContext();
        self.description = this.description;
        self.it = this.it;
        self.key = this.key;
        self.oldDescription = this.oldDescription;
        return self;
    }
}
