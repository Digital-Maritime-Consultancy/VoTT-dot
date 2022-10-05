import React, { ReactElement } from "react";
import * as shortid from "shortid";
import { CanvasTools } from "@digital-maritime-consultancy/vott-dot-ct";
import { RegionData } from "@digital-maritime-consultancy/vott-dot-ct/lib/js/CanvasTools/Core/RegionData";
import {
    EditingContext,
    EditorMode, IAssetMetadata,
    IProject, IRegion, ITag, RegionType,
} from "../../../../models/applicationState";
import CanvasHelpers from "./canvasHelpers";
import { AssetPreview, ContentSource } from "../../common/assetPreview/assetPreview";
import Clipboard from "../../../../common/clipboard";
import Confirm from "../../common/confirm/confirm";
import { strings } from "../../../../common/strings";
import { SelectionMode } from "@digital-maritime-consultancy/vott-dot-ct/lib/js/CanvasTools/Interface/ISelectorSettings";
import { Rect } from "@digital-maritime-consultancy/vott-dot-ct/lib/js/CanvasTools/Core/Rect";
import { EditorToolbar } from "./editorToolbar";
import { IToolbarItemRegistration, ToolbarItemFactory } from "../../../../providers/toolbar/toolbarItemFactory";
import IProjectActions from "../../../../redux/actions/projectActions";
import { ToolbarItem } from "../../toolbar/toolbarItem";
import _ from "lodash";
import { TagInput } from "../../common/tagInput/tagInput";
import AttributeInput from "../../common/attributeInput/attributeInput";
import { KeyboardBinding } from "../../common/keyboardBinding/keyboardBinding";
import { KeyEventType } from "../../common/keyboardManager/keyboardManager";
import { Color } from "@digital-maritime-consultancy/vott-dot-ct/lib/js/CanvasTools/Core/Colors/Color";

export interface ICanvasProps extends React.Props<Canvas> {
    selectedAsset: IAssetMetadata;
    editorMode: EditorMode;
    project: IProject;
    lockedTags: string[];
    children?: ReactElement<AssetPreview>;
    context?: EditingContext;
    actions?: IProjectActions;
    selectedRegions: IRegion[];
    confirmTagDeleted?: (tagName: string) => void;
    confirmTagRenamed?: (tagName: string, newTagName: string) => void;
    onAssetMetadataChanged?: (assetMetadata: IAssetMetadata) => void;
    onCanvasRendered?: (canvas: HTMLCanvasElement) => void;
    onToolbarItemSelected?: (toolbarItem: ToolbarItem) => void;
    onSelectedRegionsChanged?: (regions: IRegion[]) => void;
}

export default class Canvas extends React.Component<ICanvasProps> {
    public static defaultProps: ICanvasProps = {
        editorMode: EditorMode.Select,
        selectedAsset: null,
        selectedRegions: [],
        project: null,
        lockedTags: [],
        context: EditingContext.None,
    };

    public editor: any;

    private canvasZone: React.RefObject<HTMLDivElement> = React.createRef();
    private clearConfirm: React.RefObject<Confirm> = React.createRef();
    private tagInput: React.RefObject<TagInput> = React.createRef();
    private attributeInput: React.RefObject<AttributeInput> = React.createRef();
    private toolbarItems: IToolbarItemRegistration[] = ToolbarItemFactory.getToolbarItems();
    private template: Rect = new Rect(20, 20);

    public render = () => {
        return (
            <>
                {[...Array(10).keys()].map((index) => {
                    return (<KeyboardBinding
                        displayName={strings.editorPage.tags.hotKey.apply}
                        key={index}
                        keyEventType={KeyEventType.KeyDown}
                        accelerators={[`${index}`]}
                        icon={"fa-tag"}
                        handler={this.handleTagHotKey} />);
                })}
                {[...Array(10).keys()].map((index) => {
                    return (<KeyboardBinding
                        displayName={strings.editorPage.tags.hotKey.lock}
                        key={index}
                        keyEventType={KeyEventType.KeyDown}
                        accelerators={[`CmdOrCtrl+${index}`]}
                        icon={"fa-lock"}
                        handler={this.handleCtrlTagHotKey} />);
                })}
                <Confirm title={strings.editorPage.canvas.removeAllRegions.title}
                    ref={this.clearConfirm as any}
                    message={strings.editorPage.canvas.removeAllRegions.confirmation}
                    confirmButtonColor="danger"
                    onConfirm={this.removeAllRegions}
                />
                <div id="canvasToolsDiv" ref={this.canvasZone} className="canvas-enabled"
                    onClick={(e) => e.stopPropagation()}>
                    { this.props.context !== EditingContext.None &&
                    <div id="toolbarDiv" className="editor-page-content-main-header">
                        <EditorToolbar project={this.props.project}
                                            items={this.getFilteredToolbarItems()}
                                            actions={this.props.actions}
                                            onToolbarItemSelected={this.props.onToolbarItemSelected} />
                    </div>
                    }
                    <div id="showZoomFactor"></div>
                    <div id="selectionDiv" onWheel={this.onWheelCapture}
                        onKeyDown={this.onKeyDown} onKeyUp={this.onKeyUp}>
                        <div id="editorDiv"></div>
                    </div>
                    {this.renderChildren()}
                </div>
                <div className="editor-page-right-sidebar">
                    <TagInput
                        ref={this.tagInput}
                        tags={this.props.project.tags}
                        editingContext={this.props.context}
                        lockedTags={this.props.lockedTags}
                        onGetSelectedRegions={this.getSelectedRegions}
                        onChange={() => {}}
                        onLockedTagsChange={() => {}}
                        onTagClick={this.onTagClicked}
                        onCtrlTagClick={this.onCtrlTagClicked}
                        onTagRenamed={this.props.confirmTagRenamed}
                        onTagDeleted={this.props.confirmTagDeleted}
                    />
                    <AttributeInput
                        ref={this.attributeInput}
                        onGetSelectedRegions={this.getSelectedRegions}
                        attributeKeys={this.props.project.attributeKeys}
                        onChange={this.onAttributeChanged}
                        onAttributesUpdated={this.applyAttribute}
                    />
                </div>
            </>
        );
    }

    public componentDidMount = () => {
        // Get references for editor and toolbar containers
        const editorContainer = document.getElementById("editorDiv") as HTMLDivElement;
        const toolbarContainer = document.getElementById("toolbarDiv") as HTMLDivElement;;

        // Init the editor with toolbar.
        this.editor = new CanvasTools.Editor(editorContainer, undefined, undefined, undefined, {
            isZoomEnabled: true,
            zoomType: 3,
        });
        this.editor.onSelectionEnd = this.onSelectionEnd;
        this.editor.onRegionMoveEnd = this.onRegionMoveEnd;
        this.editor.onRegionSelected = this.onRegionSelected;
        this.editor.onRegionDelete = this.onRegionDelete;
        this.editor.AS.setSelectionMode({ mode: SelectionMode.NONE });
        this.editor.ZM.setMaxZoomScale(10);

        const showZoomDiv = document.getElementById("showZoomFactor");
        this.editor.onZoomEnd = function (zoom) {
            showZoomDiv.innerText = "Image zoomed at " + zoom.currentZoomScale * 100 + " %";
        };
    }

    public componentDidUpdate = async (prevProps: Readonly<ICanvasProps>) => {
        // Handle region selection in canvas
        /*
        if (this.editor) {
            if (!_.isEqual(this.props.selectedRegions, prevProps.selectedRegions) ||
                this.props.selectedRegions.length && this.editor.RM.getSelectedRegions().length === 0) {
                    this.props.selectedRegions.forEach((r: IRegion) => this.editor.RM.selectRegionById(r.id));
            }
        }//*/

        if (this.props.context !== prevProps.context) {
            this.refreshCanvasToolsRegions();
            //this.setContentSource(this.state.contentSource);
            //this.editor.AS.setSelectionMode({mode: this.props.selectionMode});
            this.editor.AS.enable();
        }

        const assetIdChanged = this.props.selectedAsset.asset.id !== prevProps.selectedAsset.asset.id;

        // When the selected asset has changed but is still the same asset id
        if (!assetIdChanged) {
            this.refreshCanvasToolsRegions();
        }

        // When the context has changed but is still the same asset id
        if (this.props.context !== prevProps.context) {
            this.refreshCanvasToolsRegions();
        }

        // When the project tags change re-apply tags to regions
        if (this.props.project.tags !== prevProps.project.tags) {
            this.updateCanvasToolsRegionTags();
        }
    }

    public setSelectionMode = (mode: SelectionMode) => {
        const options = (mode === SelectionMode.COPYRECT) ? this.template : null;
        this.editor.AS.setSelectionMode({ mode, template: options });
    }

    public getAllRegions(): IRegion[] {
        return this.editor.RM.getAllRegions().map(
            r => CanvasHelpers.fromRegionToIRegion(this.editor,
                r.id,
                this.props.selectedAsset.asset.size.width,
                this.props.selectedAsset.asset.size.height,
                r.regionData,
                r.attributes,
                CanvasHelpers.getTagsString(this.props.project.tags, r.tags)));
    }

    /**
     * Toggles tag on all selected regions
     * @param selectedTag Tag name
     */
    public applyTag = (tag: string) => {
        const selectedRegions = this.getSelectedRegions();
        const lockedTags = this.props.lockedTags;
        const lockedTagsEmpty = !lockedTags || !lockedTags.length;
        const regionsEmpty = !selectedRegions || !selectedRegions.length;
        if ((!tag && lockedTagsEmpty) || regionsEmpty) {
            return;
        }
        let transformer: (tags: string[], tag: string) => string[];
        if (process.env.REACT_APP_SINGLE_TAG_CONSTRAINT) {
            transformer = CanvasHelpers.toggleSingleTag;
        } else {
            if (lockedTagsEmpty) {
                // Tag selected while region(s) selected
                transformer = CanvasHelpers.toggleTag;
            } else if (lockedTags.find((t) => t === tag)) {
                // Tag added to locked tags while region(s) selected
                transformer = CanvasHelpers.addIfMissing;
            } else {
                // Tag removed from locked tags while region(s) selected
                transformer = CanvasHelpers.removeIfContained;
            }
        }
        for (const selectedRegion of selectedRegions) {
            selectedRegion.tags = transformer(selectedRegion.tags, tag);
        }
        this.updateRegions(selectedRegions);
    }

    public applyAttribute = (key: string, value: string) => {
        const regions = this.getSelectedRegions();
        for (const region of regions) {
            const safekey =
                CanvasHelpers.getAttributeForProject(this.props.project.attributeKeys.map(e => e.name), key);
            if (safekey) {
                this.editor.RM.updateAttributeById(region.id, safekey, value);
            }
        }
    }

    public copyRegions = async () => {
        if (this.props.context === EditingContext.None) {
            return ;
        }
        await Clipboard.writeObject(this.getSelectedRegions());
    }

    public cutRegions = async () => {
        if (this.props.context === EditingContext.None) {
            return ;
        }
        const selectedRegions = this.getSelectedRegions();
        await Clipboard.writeObject(selectedRegions);
        this.deleteRegions(selectedRegions);
    }

    public pasteRegions = async () => {
        if (this.props.context === EditingContext.None) {
            return ;
        }
        const regionsToPaste: IRegion[] = await Clipboard.readObject();
        const asset = this.props.selectedAsset;
        const duplicates = CanvasHelpers.duplicateRegionsAndMove(
            regionsToPaste,
            asset.regions,
            asset.asset.size.width,
            asset.asset.size.height,
        );
        this.addRegions(duplicates);
    }

    public confirmRemoveAllRegions = () => {
        this.clearConfirm.current.open();
    }

    public getSelectedRegions = (): IRegion[] => {
        if (this.editor) {
            const selectedRegions = this.editor.RM.getSelectedRegions();
            return selectedRegions.map(r =>
                CanvasHelpers.fromRegionToIRegion(
                    this.editor,
                    r.id,
                    this.props.selectedAsset.asset.size.width,
                    this.props.selectedAsset.asset.size.height,
                    r.regionData,
                    r.attributes,
                    CanvasHelpers.getTagsString(this.props.project.tags, r.tags)));
        } else {
            return [];
        }
    }

    public updateCanvasToolsRegionTags = (): void => {
        for (const region of this.props.selectedAsset.regions) {
            this.editor.RM.updateTagsById(
                region.id,
                CanvasHelpers.getTagsDescriptor(this.props.project.tags, region),
            );
        }
    }

    /**
     * Called when a tag from footer is clicked
     * @param tag Tag clicked
     */
    public onTagClicked = (tag: ITag): void => {
        this.applyTag(tag.name);
        if (this.tagInput.current) {
            this.tagInput.current.setSelectedTag(tag.name);
        }
    }

    public onCtrlTagClicked = (tag: ITag): void => {
        const locked = this.props.lockedTags;
        this.setState({
            selectedTag: tag.name,
            lockedTags: CanvasHelpers.toggleTag(locked, tag.name),
        }, () => this.applyTag(tag.name));
    }

    private removeAllRegions = () => {
        if (this.props.context === EditingContext.None) {
            return ;
        }
        const ids = this.props.selectedAsset.regions.map((r) => r.id);
        for (const id of ids) {
            this.editor.RM.deleteRegionById(id);
        }
        this.deleteRegionsFromAsset(this.props.selectedAsset.regions);
    }

    private addRegions = (regions: IRegion[]) => {
        this.addRegionsToCanvasTools(regions);
        this.addRegionsToAsset(regions);
    }

    private addRegionsToAsset = (regions: IRegion[]) => {
        this.updateAssetRegions(
            this.props.selectedAsset.regions.concat(regions),
        );
    }

    private addRegionsToCanvasTools = (regions: IRegion[]) => {
        for (const region of regions) {
            const regionData = CanvasHelpers.getRegionData(region);
            const scaledRegionData = this.editor.scaleRegionToFrameSize(
                regionData,
                this.props.selectedAsset.asset.size.width,
                this.props.selectedAsset.asset.size.height);
            this.editor.RM.addRegion(
                region.id,
                scaledRegionData,
                CanvasHelpers.getTagsDescriptor(this.props.project.tags, region),
            );
        }
    }

    private deleteRegions = (regions: IRegion[]) => {
        if (this.props.context === EditingContext.None) {
            return ;
        }
        this.deleteRegionsFromCanvasTools(regions);
        this.deleteRegionsFromAsset(regions);
    }

    private deleteRegionsFromAsset = (regions: IRegion[]) => {
        const filteredRegions = this.props.selectedAsset.regions.filter((assetRegion) => {
            return !regions.find((r) => r.id === assetRegion.id);
        });
        this.updateAssetRegions(filteredRegions);
    }

    private deleteRegionsFromCanvasTools = (regions: IRegion[]) => {
        for (const region of regions) {
            this.editor.RM.deleteRegionById(region.id);
        }
    }

    private getFilteredToolbarItems = () => {
        return this.toolbarItems.filter(e => e.config.context.indexOf(this.props.context) >= 0);
    }

    /**
     * Method that gets called when a new region is drawn
     * @param {RegionData} regionData the RegionData of created region
     * @returns {void}
     */
    private onSelectionEnd = (regionData: RegionData) => {
        if (CanvasHelpers.isEmpty(regionData)) {
            return;
        }
        const id = shortid.generate();

        let selectedTag;
        if (this.tagInput.current) {
            selectedTag = this.tagInput.current.getSelectedTag();
        }
        this.editor.RM.addRegion(id, regionData, new CanvasTools.Core.TagsDescriptor(
            selectedTag ? [new CanvasTools.Core.Tag(selectedTag.name, new Color(selectedTag.color))] : []
        ));
        this.template = new Rect(regionData.width, regionData.height);

        const lockedTags = this.props.lockedTags;

        const newRegion = CanvasHelpers.fromRegionToIRegion(
            this.editor, id,
            this.props.selectedAsset.asset.size.width,
            this.props.selectedAsset.asset.size.height,
            regionData,
            {},
            selectedTag ? selectedTag : [],
        );

        if (lockedTags && lockedTags.length) {
            this.editor.RM.updateTagsById(id, CanvasHelpers.getTagsDescriptor(this.props.project.tags, newRegion));
        }

        this.editor.RM.selectRegionById(id);
        //this.updateAssetRegions([...this.props.selectedAsset.regions, newRegion]);
    }

    /**
     * Update regions within the current asset
     * @param regions
     * @param selectedRegions
     */
    private updateAssetRegions = (regions: IRegion[]) => {
        if (this.props.context === EditingContext.None) {
            return ;
        }
        const currentAsset: IAssetMetadata = {
            ...this.props.selectedAsset,
            regions,
        };
        this.props.onAssetMetadataChanged(currentAsset);
    }

    /**
     * Method called when moving a region already in the editor
     * @param {string} id the id of the region that was moved
     * @param {RegionData} regionData the RegionData of moved region
     * @returns {void}
     */
    private onRegionMoveEnd = (id: string, regionData: RegionData) => {
        if (this.props.context === EditingContext.None) {
            return ;
        }
        const currentRegions = this.props.selectedAsset.regions;
        const movedRegionIndex = currentRegions.findIndex((region) => region.id === id);
        const movedRegion = currentRegions[movedRegionIndex];
        const scaledRegionData = this.editor.scaleRegionToSourceSize(
            regionData,
            this.props.selectedAsset.asset.size.width,
            this.props.selectedAsset.asset.size.height,
        );

        if (movedRegion) {
            movedRegion.points = scaledRegionData.points;
            movedRegion.boundingBox = {
                height: scaledRegionData.height,
                width: scaledRegionData.width,
                left: scaledRegionData.x,
                top: scaledRegionData.y,
            };
        }

        currentRegions[movedRegionIndex] = movedRegion;

        this.onRegionSelected(id, false);
        //this.updateAssetRegions(currentRegions);
        /*
        if (this.props.onSelectedRegionsChanged) {
            if (this.editor.RM.getSelectedRegions().length) {
                this.props.onSelectedRegionsChanged(this.getSelectedRegions());
            } else {
                this.props.onSelectedRegionsChanged([]);
            }
        }
        */
    }

    /**
     * Method called when deleting a region from the editor
     * @param {string} id the id of the deleted region
     * @returns {void}
     */
    private onRegionDelete = (id: string) => {
        if (this.props.context === EditingContext.None) {
            return ;
        }
        // Remove from Canvas Tools
        this.editor.RM.deleteRegionById(id);

        // Remove from project
        const currentRegions = this.props.selectedAsset.regions;
        const deletedRegionIndex = currentRegions.findIndex((region) => region.id === id);
        currentRegions.splice(deletedRegionIndex, 1);

        /*
        this.updateAssetRegions(currentRegions);
        */

        if (this.props.onSelectedRegionsChanged) {
            this.props.onSelectedRegionsChanged([]);
        }
    }

    /**
     * Method called when deleting a region from the editor
     * @param {string} id the id of the selected region
     * @param {boolean} multiSelect boolean whether region was selected with multi selection
     * @returns {void}
     */
    private onRegionSelected = (id: string, multiSelect: boolean) => {
        const selectedRegions = this.getSelectedRegions();
        /*
        if (this.props.onSelectedRegionsChanged) {
            this.props.onSelectedRegionsChanged(selectedRegions);
        }
        */

        // Gets the scaled region data
        const selectedRegionsData = this.editor.RM.getAllRegions().find((region) => region.id === id);

        if (selectedRegionsData) {
            this.template = new Rect(selectedRegionsData.width, selectedRegionsData.height);
        }

        if (this.props.lockedTags && this.props.lockedTags.length) {
            for (const selectedRegion of selectedRegions) {
                selectedRegion.tags = CanvasHelpers.addAllIfMissing(selectedRegion.tags, this.props.lockedTags);
            }
            this.updateRegions(selectedRegions);
        }

        if (this.tagInput.current) {
            if (selectedRegions.length) {
                for (const selectedRegion of selectedRegions) {
                    this.tagInput.current.setSelectedTag(selectedRegion.tags.pop());
                }
            } else {
                this.tagInput.current.setSelectedTag("");
            }
        }

        if (this.attributeInput.current) {
            if (selectedRegions.length) {
                for (const selectedRegion of selectedRegions) {
                    this.attributeInput.current.setSelectedAttributes(selectedRegion.attributes);
                }
            } else {
                this.attributeInput.current.setSelectedAttributes({});
            }
        }

        if (this.props.onSelectedRegionsChanged) {
            this.props.onSelectedRegionsChanged(selectedRegions);
        }
    }

    private renderChildren = () => {
        return React.cloneElement(this.props.children, {
            onAssetChanged: this.onAssetChanged,
            onLoaded: this.onAssetLoaded,
            onError: this.onAssetError,
            onActivated: this.onAssetActivated,
            onDeactivated: this.onAssetDeactivated,
        });
    }

    /**
     * Raised when the asset bound to the asset preview has changed
     */
     private onAssetChanged = () => {

    }
    /**
     * Raised when the underlying asset has completed loading
     */
    private onAssetLoaded = (contentSource: ContentSource) => {
        this.refreshCanvasToolsRegions();
        this.editor.addContentSource(contentSource);
        this.editor.AS.enable();
    }
    private onAssetError = () => {

    }

    /**
     * Raised when the asset is taking control over the rendering
     */
     private onAssetActivated = () => {
        
    }

    /**
     * Raise when the asset is handing off control of rendering
     */
     private onAssetDeactivated = (contentSource: ContentSource) => {
        
    }

    /**
     * Updates regions in both Canvas Tools and the asset data store
     * @param updates Regions to be updated
     * @param updatedSelectedRegions Selected regions with any changes already applied
     */
    private updateRegions = (updates: IRegion[]) => {
        const updatedRegions = CanvasHelpers.updateRegions(this.props.selectedAsset.regions, updates);
        for (const update of updates) {
            this.editor.RM.updateTagsById(update.id, CanvasHelpers.getTagsDescriptor(this.props.project.tags, update));

            // update attributes for regions
            Object.keys(update.attributes).forEach(key => {
                const result = CanvasHelpers.getAttributeForProject(this.props.project.attributeKeys.map(e => e.name), key);
                if (result) {
                    const value = update.attributes[key];
                    this.editor.RM.updateAttributeById(update.id, key, value);
                }
              });
        }
        //this.updateAssetRegions(updatedRegions);
        this.updateCanvasToolsRegionTags();
    }

    /**
     * Updates the background of the canvas and draws the asset's regions
     */
    private clearAllRegions = () => {
        this.editor.RM.deleteAllRegions();
    }

    private refreshCanvasToolsRegions = () => {
        this.clearAllRegions();

        if (!this.props.selectedAsset.regions || this.props.selectedAsset.regions.length === 0) {
            return;
        }

        // Add regions to the canvas
        this.props.selectedAsset.regions.forEach((region: IRegion) => {
            if (this.props.context === EditingContext.EditDot || this.props.context === EditingContext.None) {
                if (region.type === RegionType.Point || region.type === RegionType.Rectangle || region.type === RegionType.Polygon) {
                    const loadedRegionData = CanvasHelpers.getRegionData(region);
                    this.editor.RM.addRegion(
                        region.id,
                        this.editor.scaleRegionToFrameSize(
                            loadedRegionData,
                            this.props.selectedAsset.asset.size.width,
                            this.props.selectedAsset.asset.size.height,
                        ),
                        CanvasHelpers.getTagsDescriptor(this.props.project.tags, region),
                        region.attributes);
                }
            } else if (this.props.context === EditingContext.EditRect) {
                if (region.type === RegionType.Rectangle || region.type === RegionType.Polygon) {
                    const loadedRegionData = CanvasHelpers.getRegionData(region);
                    this.editor.RM.addRegion(
                        region.id,
                        this.editor.scaleRegionToFrameSize(
                            loadedRegionData,
                            this.props.selectedAsset.asset.size.width,
                            this.props.selectedAsset.asset.size.height,
                        ),
                        CanvasHelpers.getTagsDescriptor(this.props.project.tags, region),
                        region.attributes);
                }
            }
        });
    }

    private onKeyDown = (e: any) => {
        if (!e.ctrlKey && !e.shiftKey && e.altKey && this.editor) {
            if (this.editor.ZM.isZoomEnabled && !this.editor.ZM.isDraggingEnabled) {
                this.editor.ZM.callbacks.onDragActivated();
            }
        }
    }

    private onKeyUp = (e: any) => {
        if (this.editor) {
            if (this.editor.ZM.isZoomEnabled) {
                this.editor.ZM.callbacks.onDragDeactivated();
            }
        }
    }

    private onWheelCapture = (e: any) => {
        if (!e.ctrlKey && !e.shiftKey && e.altKey && this.editor) {
            const cursorPos = this.getCursorPos(e);
            if (e.deltaY < 0) {
                this.editor.ZM.callbacks.onZoomingIn(cursorPos);
            } else if (e.deltaY > 0) {
                this.editor.ZM.callbacks.onZoomingOut(cursorPos);
            }
            e.nativeEvent.stopImmediatePropagation();
            e.stopPropagation();
        }
    }

    private getCursorPos = (e: any) => {
        const editorContainer = document.getElementsByClassName("CanvasToolsEditor")[0];
        let containerPos, x = 0, y = 0;
        e = e || window.event;
        /*get the x and y positions of the container:*/
        containerPos = editorContainer.getBoundingClientRect();

        /*get the x and y positions of the image:*/
        const editorStyles = window.getComputedStyle(editorContainer);
        const imagePos = {
            left: containerPos.left + parseFloat(editorStyles.paddingLeft),
            top: containerPos.top + parseFloat(editorStyles.paddingTop)
        };


        /*calculate the cursor's x and y coordinates, relative to the image:*/
        x = e.pageX - imagePos.left;
        y = e.pageY - imagePos.top;
        /*consider any page scrolling:*/
        x = x - window.pageXOffset;
        y = y - window.pageYOffset;
        return {x : x, y : y};
    }

    private onAttributeChanged = async (key: string, value: string): Promise<void> => {
        if (this.getSelectedRegions().length) {
            this.applyAttribute(key, value);
        }
    }

    /**
     * Listens for {number key} and calls `onTagClicked` with tag corresponding to that number
     * @param event KeyDown event
     */
     private handleTagHotKey = (event: KeyboardEvent): void => {
        const tag = this.getTagFromKeyboardEvent(event);
        if (tag) {
            this.onTagClicked(tag);
        }
    }

    private handleCtrlTagHotKey = (event: KeyboardEvent): void => {
        const tag = this.getTagFromKeyboardEvent(event);
        if (tag) {
            this.onCtrlTagClicked(tag);
        }
    }

    private getTagFromKeyboardEvent = (event: KeyboardEvent): ITag => {
        let key = parseInt(event.key, 10);
        if (isNaN(key)) {
            try {
                key = parseInt(event.key.split("+")[1], 10);
            } catch (e) {
                return;
            }
        }
        let index: number;
        const tags = this.props.project.tags;
        if (key === 0 && tags.length >= 10) {
            index = 9;
        } else if (key < 10) {
            index = key - 1;
        }
        if (index < tags.length) {
            return tags[index];
        }
        return null;
    }
}
