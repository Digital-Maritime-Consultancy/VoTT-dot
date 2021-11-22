import { IAssetMetadata, ModelPathType, IActiveLearningSettings, AssetState } from "../models/applicationState";
import { ObjectDetection } from "../providers/activeLearning/objectDetection";
import Guard from "../common/guard";
import { isElectron } from "../common/hostProcess";
import { Env } from "../common/environment";

import axios from 'axios';

export class PointToRectService {
    private connected: boolean = false;

    constructor(private url: string) {
        Guard.null(url);
    }

    public isConnected() {
        return this.connected;
    }

    public async process(assetMetadata: IAssetMetadata): Promise<IAssetMetadata> {
        Guard.null(assetMetadata);

        // If the canvas or asset are invalid return asset metadata
        if (!(assetMetadata.asset && assetMetadata.asset.size)) {
            return assetMetadata;
        }
        // should be calculated
        const predictedRegions = await this.submit(assetMetadata);
        
        const updatedRegions = [...assetMetadata.regions];
        predictedRegions.regions.forEach((prediction) => {
            const matchingRegion = updatedRegions.find((region) => {
                return region.boundingBox
                    && region.boundingBox.left === prediction.boundingBox.left
                    && region.boundingBox.top === prediction.boundingBox.top
                    && region.boundingBox.width === prediction.boundingBox.width
                    && region.boundingBox.height === prediction.boundingBox.height;
            });

            if (updatedRegions.length === 0 || !matchingRegion) {
                updatedRegions.push(prediction);
            }
        });

        return {
            ...assetMetadata,
            regions: updatedRegions,
            asset: {
                ...assetMetadata.asset,
                state: updatedRegions.length > 0 ? AssetState.Tagged : AssetState.Visited,
                predicted: true,
            },
        } as IAssetMetadata;
    }

    public async ensureConnected(): Promise<void> {
        if (this.connected) {
            return Promise.resolve();
        }

        await this.connect()
        .then((response) => {
            if (response.status === 200) {
                this.connected = true;
            }
            else {
                this.connected = false;
            }
        })
        .catch((error) => {
            this.connected = false;
        });
    }

    private async connect() {
        return await axios.get(this.url);
    }

    private async submit(body: IAssetMetadata): Promise<IAssetMetadata> {
        return await axios({
            method: 'post',
            url: this.url + '/process',
            data: body,
            headers: {
                'Content-Type': 'application/json',
            },
        })
            .then(function (response) {
                return response.data;
            })
            .catch(function (error) {
                console.log(error);
                return [];
            });
    }

    private getAppPath = () => {
        const remote = (window as any).require("electron").remote as Electron.Remote;
        return remote.app.getAppPath();
    }
}
