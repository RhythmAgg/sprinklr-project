const helperDependency = () => {
    console.log('this is a helper dependency')
}
export function directExport() {
    // this is a direct Export
    helperDependency()
}

// barrel-export
export {exp1 as exp1Renamed} from './multipleExports'