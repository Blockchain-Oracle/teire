# Banner source

`banner.html` at 1280×640, rendered at 2× (2560×1280) with headless Chrome; `#dark` renders the dark one.
`run-light.png` and `run-dark.png` are the live run page of teire-demo-bristow#8
(`/runs/c154b1d4-ed40-4860-912d-5c587916c2e2`) at 1440×900.

```bash
PUPPETEER=<path to puppeteer> CHROME=<path to Chrome> node render.cjs "$PWD/banner.html" ../banner-light.png "" 1280 640
PUPPETEER=<path to puppeteer> CHROME=<path to Chrome> node render.cjs "$PWD/banner.html" ../banner-dark.png "#dark" 1280 640
```
