
import { CodeDict, StringDict } from "./types";

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

    reset() {
        let self = new TestContext();
        self.description = this.description;
        self.it = this.it;
        self.key = this.key;
        self.oldDescription = this.oldDescription;
        return self;
    }
}
