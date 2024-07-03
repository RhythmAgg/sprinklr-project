import type { ColorPickerOverrides } from "./types";
import * as wildCardImport from './mixedExportModule'
import { exp1 } from "test_package/targetModule";


wildCardImport.exp1Renamed()

export default function Main() {
    wildCardImport.directExport()
    console.log('This is TS importing module')
}