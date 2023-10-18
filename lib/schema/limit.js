"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LimitedOperations = void 0;
var LimitedOperations;
(function (LimitedOperations) {
    LimitedOperations[LimitedOperations["None"] = 0] = "None";
    LimitedOperations[LimitedOperations["Read"] = 1] = "Read";
    LimitedOperations[LimitedOperations["Write"] = 2] = "Write";
    LimitedOperations[LimitedOperations["Delete"] = 4] = "Delete";
    LimitedOperations[LimitedOperations["Invoke"] = 8] = "Invoke";
    LimitedOperations[LimitedOperations["All"] = 15] = "All";
})(LimitedOperations = exports.LimitedOperations || (exports.LimitedOperations = {}));
