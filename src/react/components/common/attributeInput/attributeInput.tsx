import React from "react";
import Form, { FormValidation, ISubmitEvent, IChangeEvent, Widget } from "react-jsonschema-form";
import { IAssetMetadata, IProject, IRegion } from "../../../../models/applicationState";
import { JSONSchema6 } from "json-schema";
import { update } from "lodash";
import { strings } from "../../../../common/strings";

export interface IAttributeInputProps{
    chosenAttributes?: {[key: string]: string; };
    attributeKeys?: string[];
    onChange?: (key: string, value: string) => void;
    onSelectedRegionsChanged?: (regions: IRegion[]) => void;
}

export interface IAttributeInputState {
    iscrowd: boolean;
    formSchema: object;
    formData: object;
}

/**
 * @name - Attribute input
 * @description - Input for attributes of region, which is a dictionary
 */
export default class AttributeInput extends React.Component<IAttributeInputProps, IAttributeInputState> {
    public static defaultProps: IAttributeInputProps = {
        chosenAttributes: {},
        onSelectedRegionsChanged: undefined,
        onChange: undefined,
    };

    public state: IAttributeInputState = {
        iscrowd: false,
        formSchema: undefined,
        formData: undefined,
    };

    constructor(props) {
        super(props);
        this.updateForm = this.updateForm.bind(this);
        this.clearForm = this.clearForm.bind(this);
    }

    public componentDidUpdate(prevProps: IAttributeInputProps) {
    }

    public clearForm() {
        this.setState( { formData: undefined } );
    }

    public updateForm(regions: IRegion[], formSchema: object) {
    }

    public render() {
        return (
            this.props.attributeKeys && this.props.attributeKeys.length > 0 &&
            <div className="condensed-list" onClick={(e) => e.stopPropagation()}>
                <div className="condensed-list-header p-2">
                    <span className="condensed-list-title">
                        {strings.projectSettings.attributeKeys.title}
                    </span>
                </div>
                <div className="condensed-list-body">
                    <div className="tag-input-items">
                    {
                        this.props.attributeKeys.map(key =>
                            <div key={key} className="tag-item row">
                                <div className="col">
                                    <span className="p-2">{key}</span>
                                </div>
                                <div className="col">
                                    <input
                                        type="text"
                                        key={key}
                                        defaultValue={this.props.chosenAttributes && this.props.chosenAttributes[key]}
                                        onChange={(e) => this.props.onChange!(key, e.currentTarget.value)}
                                    />
                                </div>
                            </div>
                        )
                    }
                    </div>
                </div>
            </div>
        );
    }
}