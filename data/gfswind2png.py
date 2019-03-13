"""
gfswind2png creates a TMS like pyramid of GFS wind data where the red and green
bands represent the u and v vector components.
Level 0 = 1 degree spatial resolution
Level 1 = 0.5 degree spatial resolution
Level 2 = 0.25 degree spatial resolution

setup: create python virtualenv with dependencies using Pipenv and the Pipfile
in this directory

usage: gfswind2png.py [-h] --timestamp TIMESTAMP [--output_dir OUTPUT_DIR]
                      [--clean]

optional arguments:
  -h, --help            show this help message and exit
  --timestamp TIMESTAMP
                        Enter timestamp in YYYYMMDDhh format. hh must be 00,
                        06, 12, 18
  --output_dir OUTPUT_DIR
                        Enter path to directory to save output. Defaults to
                        the current working directory.
  --clean               Cleans local folders
"""


import os
import pathlib
import json
import argparse
import glob
from datetime import datetime

import requests
from requests import HTTPError
import numpy as np
import rasterio
from rasterio.plot import reshape_as_image
from PIL import Image


def download_data(filename, product, timestamp):
    if product == "0p50":
        full = "full"
    else:
        full = ""

    url = (
        f"https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_{product}.pl?"
        f"file=gfs.t{timestamp[-2:]}z.pgrb2{full}.{product}.f000"
        f"&lev_10_m_above_ground=on&var_UGRD=on&var_VGRD=on&leftlon=0"
        f"&rightlon=360&toplat=90&bottomlat=-90&dir=%2Fgfs.{timestamp}"
    )

    try:
        r = requests.get(url)
        r.raise_for_status()
    except HTTPError as e:
        raise HTTPError("Something went wrong with the data download.") from e

    with open(filename, "wb") as f:
        f.write(r.content)


def import_data(filename):
    with rasterio.open(filename) as src:
        return src.read()


def prepare_array(bands):
    # Drop extra row in array
    # TODO: Something more elegant like interpolate rows
    bands = bands[:, :-1, :]

    # Convert coverage from 0->360 to -180->180
    bands = np.roll(bands, int(0.5 * bands.shape[2]), 2)

    # rescale values from floats to uint8
    for i in range(0, bands.shape[0]):
        bands[i] = (
            255
            * (bands[i] - bands[i].min())
            / (bands[i].max() - bands[i].min())
        )

    # Build array in image format
    empty_band = np.zeros((1, bands.shape[1], bands.shape[2]))

    bands = np.concatenate((bands, empty_band), axis=0)
    bands = bands.astype(np.uint8)

    return bands


def build_meta_json(data_dir, datetime, width, height, umin, umax, vmin, vmax):
    return {
        "source": "http://nomads.ncep.noaa.gov",
        "date": datetime,
        "width": width,
        "height": height,
        "uMin": round(umin, 2),
        "uMax": round(umax, 2),
        "vMin": round(vmin, 2),
        "vMax": round(vmax, 2),
        "minzoom": 0,
        "maxzoom": 2,
        "tiles": [f"{data_dir}/{{z}}/{{x}}/{{y}}.png"],
    }


def write_json(data_dir, json_output):
    with open(f"{data_dir}tile.json", "w") as f:
        f.write(json.dumps(json_output, indent=4, separators=(",", ": ")))


def write_image(filename, image):
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    im = Image.fromarray(image)
    im.save(filename)


def slice_image(image, start_y, end_y, start_x, end_x):
    return image[start_y:end_y, start_x:end_x, :]


if __name__ == "__main__":
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--timestamp",
        type=str,
        required=True,
        help="Enter timestamp in YYYYMMDDhh format. hh must be 00, 06, 12, 18",
    )

    parser.add_argument(
        "--output_dir",
        type=str,
        default=pathlib.Path(__file__).resolve().parent,
        help=(
            "Enter path to directory to save output. "
            "Defaults to the current working directory."
        )
    )

    parser.add_argument(
        "--clean",
        dest="clean",
        action="store_true",
        help="Cleans local folders",
    )

    args = parser.parse_args()

    tilejson_variables = {}

    tilejson_variables["height"] = 180
    tilejson_variables["width"] = 360

    try:
        tilejson_variables["datetime"] = datetime.strptime(
            f"{args.timestamp}+0000", "%Y%m%d%H%z"
        ).isoformat()
    except ValueError as e:
        raise ValueError("Invalid timestamp entered.") from e

    for product in ("1p00", "0p50", "0p25"):
        filename = f"{args.output_dir}{args.timestamp}_{product}.grb"
        
        # TODO: can probably streamline these steps without saving intermediary files
        download_data(filename, product, args.timestamp)
        bands = import_data(filename)

        tilejson_variables["umin"] = bands[0, :, :].min()
        tilejson_variables["umax"] = bands[0, :, :].max()
        tilejson_variables["vmin"] = bands[1, :, :].min()
        tilejson_variables["vmax"] = bands[1, :, :].max()

        bands = prepare_array(bands)

        image = reshape_as_image(bands)

        if product == "1p00":
            filename = f"{args.timestamp}/0/0/0.png"
            write_image(filename, image)

        elif product == "0p50":
            tiles = [
                ("0/1", (0, 180, 0, 360)),
                ("1/1", (0, 180, 360, 720)),
                ("0/0", (180, 360, 0, 360)),
                ("1/0", (180, 360, 360, 720)),
            ]

            for path, slices in tiles:
                filename = f"{args.timestamp}/1/{path}.png"
                image_cut = slice_image(image, *slices)
                write_image(filename, image_cut)

        elif product == "0p25":
            tiles = [
                ("0/3", (0, 180, 0, 360)),
                ("1/3", (0, 180, 360, 720)),
                ("2/3", (0, 180, 720, 1080)),
                ("3/3", (0, 180, 1080, 1440)),
                ("0/2", (180, 360, 0, 360)),
                ("1/2", (180, 360, 360, 720)),
                ("2/2", (180, 360, 720, 1080)),
                ("3/2", (180, 360, 1080, 1440)),
                ("0/1", (360, 540, 0, 360)),
                ("1/1", (360, 540, 360, 720)),
                ("2/1", (360, 540, 720, 1080)),
                ("3/1", (360, 540, 1080, 1440)),
                ("0/0", (540, 720, 0, 360)),
                ("1/0", (540, 720, 360, 720)),
                ("2/0", (540, 720, 720, 1080)),
                ("3/0", (540, 720, 1080, 1440)),
            ]

            for path, slices in tiles:
                filename = f"{args.timestamp}/2/{path}.png"
                image_cut = slice_image(image, *slices)
                write_image(filename, image_cut)

            json_output = build_meta_json(args.timestamp, **tilejson_variables)
            write_json(f"{args.output_dir}/{args.timestamp}/", json_output)

    if args.clean:
        for f in glob.glob(f"{args.output_dir}*.grb"):
            os.remove(f)
