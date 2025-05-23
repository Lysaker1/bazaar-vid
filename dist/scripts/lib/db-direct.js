"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbUtils = exports.db = exports.pool = void 0;
exports.query = query;
exports.listTables = listTables;
exports.getTableSchema = getTableSchema;
exports.getTableCount = getTableCount;
exports.closeConnection = closeConnection;
var node_postgres_1 = require("drizzle-orm/node-postgres");
var pg_1 = require("pg");
var schema = require("../../server/db/schema");
// Connection credentials
var DATABASE_URL = 'postgresql://bazaar-vid-db_owner:npg_MtB3K7XgkQqN@ep-still-salad-a4i8qp7g-pooler.us-east-1.aws.neon.tech/bazaar-vid-db?sslmode=require';
var DATABASE_URL_NON_POOLED = 'postgresql://bazaar-vid-db_owner:npg_MtB3K7XgkQqN@ep-still-salad-a4i8qp7g.us-east-1.aws.neon.tech/bazaar-vid-db?sslmode=require';
// Create connection pool
exports.pool = new pg_1.Pool({
    connectionString: DATABASE_URL,
});
// Create drizzle ORM instance with all schema tables
exports.db = (0, node_postgres_1.drizzle)(exports.pool, { schema: schema });
// Raw SQL query function for direct queries
function query(sql_1) {
    return __awaiter(this, arguments, void 0, function (sql, params) {
        var result, error_1;
        if (params === void 0) { params = []; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, exports.pool.query(sql, params)];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.rows];
                case 2:
                    error_1 = _a.sent();
                    console.error('Database query error:', error_1);
                    throw error_1;
                case 3: return [2 /*return*/];
            }
        });
    });
}
// List all tables in the database
function listTables() {
    return __awaiter(this, void 0, void 0, function () {
        var sql;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    sql = "\n    SELECT table_name \n    FROM information_schema.tables \n    WHERE table_schema = 'public'\n    ORDER BY table_name;\n  ";
                    return [4 /*yield*/, query(sql)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
// Get table schema
function getTableSchema(tableName) {
    return __awaiter(this, void 0, void 0, function () {
        var sql;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    sql = "\n    SELECT column_name, data_type, is_nullable, column_default\n    FROM information_schema.columns\n    WHERE table_schema = 'public' AND table_name = $1\n    ORDER BY ordinal_position;\n  ";
                    return [4 /*yield*/, query(sql, [tableName])];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
// Get count of rows in a table
function getTableCount(tableName) {
    return __awaiter(this, void 0, void 0, function () {
        var sql, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    sql = "SELECT COUNT(*) as count FROM ".concat(tableName, ";");
                    return [4 /*yield*/, query(sql)];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, parseInt(result[0].count)];
            }
        });
    });
}
// Close the database connection
function closeConnection() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, exports.pool.end()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// Export a complete DB utility for easy imports
exports.dbUtils = {
    db: exports.db,
    pool: exports.pool,
    query: query,
    listTables: listTables,
    getTableSchema: getTableSchema,
    getTableCount: getTableCount,
    closeConnection: closeConnection
};
