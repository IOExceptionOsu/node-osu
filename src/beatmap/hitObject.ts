import {ParseError} from "../errors";
import SliderMath from "../math/slider";
import {Spline} from "../math/spline";
import Vector from "../math/vector";

import {Beatmap} from ".";
import Hitsound from "./additions";
import {AdditionType, CurveType, HitsoundType} from "./structs";

const constants = require("../constants");

let additionTypes = [ null, "normal", "soft", "drum" ];

export abstract class HitObject {
    public StackHeight: number = 0;
    public ComboNumber: number = 0;
    public Parent: Beatmap|null = null;

    constructor(
        public FadeTime: number,
        public NewCombo: boolean,
        public Hitsound: Hitsound,
        public StartTime: number,
        public EndTime: number,
        public Position: Vector,
        public EndPosition: Vector,
    ) {}

    static parseEdgeAdditions(str: string): {sample: HitsoundType, additions: AdditionType}|null {
        let sample: HitsoundType|null = null, additions: AdditionType|null = null;
        let parts = str.split(":");

        if (parts[0] && parts[0] !== "0")
            sample = parseInt(parts[0]);
        if (parts[1] && parts[1] !== "0")
            additions = parseInt(parts[1]);

        if (sample == null || additions == null)
            return null;
        return {sample, additions};
    }
    static parse(line: string): HitObject {
        let fadeTime: number = 0;
        let spline = null;
        let startTime: number, endTime: number;
        let curveType: CurveType = 0;

        let parts = line.split(",");
        let soundType = parseInt(parts[4]);
        let objectType = parseInt(parts[3]);
        let i;

        startTime = endTime = parseInt(parts[2]);
        let soundTypes = [];
        let newCombo: boolean = (objectType & 4) == 4;
        let position = new Vector(parseInt(parts[0]), parseInt(parts[1]));
        let customColor = (objectType >>> 4) & 7;

        // if ((soundType & 2) == 2)
        //     properties.soundTypes.push("whistle");
        // if ((soundType & 4) == 4)
        //     properties.soundTypes.push("finish");
        // if ((soundType & 8) == 8)
        //     properties.soundTypes.push("clap");
        // if (properties.soundTypes.length == 0)
        //     properties.soundTypes.push("normal");

        if ((objectType & 1) == 1) {
            let hitsound = Hitsound.parse(parts[5]);
            return new HitCircle(
                fadeTime,
                newCombo,
                hitsound,
                startTime,
                endTime,
                position,
                position,
            );
        } else if ((objectType & 2) == 2) {
            let repeatCount = parseInt(parts[6]);
            let pixelLength = parseFloat(parts[7]);
            let hitsound = Hitsound.parse(parts[10]);

            let controlPoints = [ position ];

            let points = (parts[5] || "").split("|");
            if (points.length) {
                switch (points[0]) {
                case "L":
                    curveType = CurveType.Linear;
                    spline = Spline.linear(controlPoints, pixelLength);
                    break;
                case "C":
                    curveType = CurveType.Catmull;
                    break;
                case "B":
                    curveType = CurveType.Bezier;
                    spline = Spline.bezier(controlPoints, pixelLength);
                    break;
                case "P":
                    curveType = CurveType.Perfect;
                    spline = Spline.perfect(controlPoints, pixelLength);
                    break;
                }
                for (i = 1; i < points.length; i += 1) {
                    let coordinates = points[i].split(":");
                    controlPoints.push(new Vector(parseInt(coordinates[0]), parseInt(coordinates[1])));
                }
            }

            // let edgeSounds = [];
            // let edgeAdditions = [];
            // if (parts[8])
            //     edgeSounds = parts[8].split("|");
            // if (parts[9])
            //     edgeAdditions = parts[9].split("|");

            // for (i = 0; i < properties.repeatCount + 1; i += 1) {
            //     let edge = {"soundTypes" : [], "additions" : HitObject.parseEdgeAdditions(edgeAdditions[i])};
            //     if (edgeSounds[i]) {
            //         let sound = parseInt(edgeSounds[i]);
            //         if ((sound & 2) == 2)
            //             edge.soundTypes.push("whistle");
            //         if ((sound & 4) == 4)
            //             edge.soundTypes.push("finish");
            //         if ((sound & 8) == 8)
            //             edge.soundTypes.push("clap");
            //         if (edge.soundTypes.length == 0)
            //             edge.soundTypes.push("normal");
            //     } else {
            //         edge.soundTypes.push("normal");
            //     }
            //     properties.edges.push(edge);
            // }

            if (spline == null)
                throw new Error(`Could not calculate spline for '${line}'.`);

            let endPosition = SliderMath.GetEndPoint(curveType, pixelLength, controlPoints);
            if (endPosition == null)
                throw new Error(`Could not determine end position for '${line}'.`);

            return new Slider(
                fadeTime,
                newCombo,
                hitsound,
                startTime,
                endTime,
                position,
                endPosition,
                curveType,
                controlPoints,
                spline,
                pixelLength,
                repeatCount,
            );
        } else if ((objectType & 8) == 8) {
            endTime = parseInt(parts[5]);
            let hitsound = Hitsound.parse(parts[6]);
            return new Spinner(
                fadeTime,
                newCombo,
                hitsound,
                startTime,
                endTime,
                position,
                position,
            );
        }
        throw new ParseError(`Bad object type ${objectType}`);
    }
    public abstract FlipVertical(): void;
}

export class HitCircle extends HitObject {
    public FlipVertical() { this.Position.y = 384 - this.Position.y; }
}

export class Slider extends HitObject {
    constructor(
        FadeTime: number,
        NewCombo: boolean,
        Hitsound: Hitsound,
        StartTime: number,
        EndTime: number,
        Position: Vector,
        EndPosition: Vector,
        public CurveType: CurveType,
        public ControlPoints: Vector[],
        public Spline: Spline,
        public PixelLength: number,
        public RepeatCount: number,
    ) {
        super(FadeTime, NewCombo, Hitsound, StartTime, EndTime, Position, EndPosition);
    }

    public Calculate(): void {
        if (this.Parent == null)
            return;

        let timing = this.Parent.GetTimingPoint(this.StartTime);
        if (timing) {
            let pxPerBeat = this.Parent.Config.SliderMultiplier * 100 * timing.Velocity;
            let beatsNumber = (this.PixelLength * this.RepeatCount) / pxPerBeat;
            let duration = Math.ceil(beatsNumber * timing.BeatLength);
            this.EndTime = this.StartTime + duration;
        }
        let spline: Spline;
        switch (this.CurveType) {
        case CurveType.Linear:
            spline = Spline.linear(this.ControlPoints, this.PixelLength);
            break;
        case CurveType.Bezier:
            spline = Spline.bezier(this.ControlPoints, this.PixelLength);
            break;
        case CurveType.Perfect:
            spline = Spline.perfect(this.ControlPoints, this.PixelLength);
            break;
        }
        // last point is the end position
        this.EndPosition = this.Spline.points[this.Spline.points.length - 1];
    }

    public FlipVertical() {
        // this.position.y = 384 - this.position.y;
        for (let i = 0; i < this.ControlPoints.length; ++i)
            this.ControlPoints[i].y = 384 - this.ControlPoints[i].y;
    }
}

export class Spinner extends HitObject {
    public FlipVertical() {}
}