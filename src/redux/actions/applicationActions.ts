import { Action, Dispatch } from "redux";
import { IpcRendererProxy } from "../../common/ipcRendererProxy";
import { ActionTypes } from "./actionTypes";
import { createPayloadAction, createAction, IPayloadAction } from "./actionCreators";
import { IAppSettings } from "../../models/applicationState";
import { IProject, IApplicationState } from "../../models/applicationState";
import { generateKey } from "../../common/crypto";

/**
 * Actions to make changes to application settings
 * @member toggleDevTools - Open or close dev tools
 * @member reloadApplication - Reload application
 */
export default interface IApplicationActions {
    toggleDevTools(show: boolean): Promise<void>;
    reloadApplication(): Promise<void>;
    saveAppSettings(appSettings: IAppSettings): IAppSettings;
    ensureSecurityToken(project: IProject): IAppSettings;
    addNewSecurityToken(name: string): IAppSettings;
}

/**
 * Open or close dev tools
 * @param show - Dev tools is open
 */
export function toggleDevTools(show: boolean): (dispatch: Dispatch) => Promise<void> {
    return (dispatch: Dispatch) => {
        return IpcRendererProxy.send("TOGGLE_DEV_TOOLS", show)
            .then(() => {
                dispatch(toggleDevToolsAction(show));
            });
    };
}

/**
 * Reload application
 */
export function reloadApplication(): (dispatch: Dispatch) => Promise<void> {
    return (dispatch: Dispatch) => {
        return IpcRendererProxy.send("RELOAD_APP")
            .then(() => {
                dispatch(refreshApplicationAction());
            });
    };
}

/**
 * Save app settings
 */
export function saveAppSettings(appSettings: IAppSettings): (dispatch: Dispatch) => Promise<IAppSettings> {
    return (dispatch: Dispatch) => {
        dispatch(saveAppSettingsAction(appSettings));
        return Promise.resolve(appSettings);
    };
}

/**
 * Ensures that a valid security token is associated with the project, otherwise creates one
 * @param project The project to validate
 */
export function ensureSecurityToken(project: IProject):
    (dispatch: Dispatch, getState: () => IApplicationState) => Promise<IAppSettings> {
    return async (dispatch: Dispatch, getState: () => IApplicationState) => {
        const appState = getState();
        const securityToken = appState.appSettings.securityTokens
            .find((st) => st.name === project.securityToken);

        if (securityToken) {
            return appState.appSettings;
        }

        await addNewSecurityToken(project.name);
        return appState.appSettings;
    };
}


export function addNewSecurityToken(name: string):
    (dispatch: Dispatch, getState: () => IApplicationState) => Promise<IAppSettings> {
    return async (dispatch: Dispatch, getState: () => IApplicationState) => {
        const appState = getState();

        const securityToken = appState.appSettings.securityTokens
            .find((st) => st.name === name);

        if (securityToken) {
            console.log("Token already exists!");
            return appState.appSettings;
        }

        const updatedAppSettings: IAppSettings = {
            devToolsEnabled: appState.appSettings.devToolsEnabled,
            securityTokens: [...appState.appSettings.securityTokens, generateSecurityToken(`${name} Token`)],
        };

        await this.saveAppSettings(updatedAppSettings);
        dispatch(ensureSecurityTokenAction(updatedAppSettings));
        return updatedAppSettings;
    }
}

function generateSecurityToken(name: string): any {
    const securityToken = {
        name, key: generateKey(),
    };
    return securityToken;
}

/**
 * Toggle Dev Tools Redux Action type
 */
export interface IToggleDevToolsAction extends IPayloadAction<string, boolean> {
    type: ActionTypes.TOGGLE_DEV_TOOLS_SUCCESS;
}

/**
 * Refresh app action type
 */
export interface IRefreshApplicationAction extends Action<string> {
    type: ActionTypes.REFRESH_APP_SUCCESS;
}

/**
 * Save app settings action type
 */
export interface ISaveAppSettingsAction extends IPayloadAction<string, IAppSettings> {
    type: ActionTypes.SAVE_APP_SETTINGS_SUCCESS;
}

/**
 * Ensure project security token action type
 */
export interface IEnsureSecurityTokenAction extends IPayloadAction<string, IAppSettings> {
    type: ActionTypes.ENSURE_SECURITY_TOKEN_SUCCESS;
}

/**
 * Instance of toggle dev tools action
 */
export const toggleDevToolsAction = createPayloadAction<IToggleDevToolsAction>(ActionTypes.TOGGLE_DEV_TOOLS_SUCCESS);
/**
 * Instance of refresh app action
 */
export const refreshApplicationAction = createAction<IRefreshApplicationAction>(ActionTypes.REFRESH_APP_SUCCESS);
/**
 * Instance of save app settings action
 */
export const saveAppSettingsAction = createPayloadAction<ISaveAppSettingsAction>(ActionTypes.SAVE_APP_SETTINGS_SUCCESS);
/**
 * Instance of Export Project action
 */
export const ensureSecurityTokenAction =
    createPayloadAction<IEnsureSecurityTokenAction>(ActionTypes.ENSURE_SECURITY_TOKEN_SUCCESS);
