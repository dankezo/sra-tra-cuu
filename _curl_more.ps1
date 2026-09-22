$ErrorActionPreference = "Continue"
$root = "D:\docu\outputs\04-sra-tra-cuu\data\raw"
function Get-File($rel, $url, $extra = @()) {
  $dest = Join-Path $root $rel
  $dir = Split-Path $dest -Parent
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  if ((Test-Path $dest) -and ((Get-Item $dest).Length -gt 5000)) {
    Write-Host "SKIP $rel $((Get-Item $dest).Length)"
    return
  }
  Write-Host "GET  $rel"
  $args = @(
    "-L", "--ssl-no-revoke", "--retry", "2", "--max-time", "120",
    "-A", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "-o", $dest, $url
  ) + $extra
  & curl.exe @args
  if (Test-Path $dest) { Write-Host "OK   $rel $((Get-Item $dest).Length)" } else { Write-Host "FAIL $rel" }
}

Get-File "ES\Medicamentos.xls" "https://listadomedicamentos.aemps.gob.es/Medicamentos.xls"
Get-File "ES\Presentaciones.xls" "https://listadomedicamentos.aemps.gob.es/Presentaciones.xls"
Get-File "ES\prescripcion.zip" "https://listadomedicamentos.aemps.gob.es/prescripcion.zip"
Get-File "CZ\DLP20260827.zip" "https://opendata.sukl.cz/soubory/SOD20260827/DLP20260827.zip"
Get-File "EE\pakendid.csv" "https://ravimiregister.ee/Data/XML/pakendid.csv" @("-H","Referer: https://www.ravimiregister.ee/")
Get-File "EE\ravimid.csv" "https://ravimiregister.ee/Data/XML/ravimid.csv" @("-H","Referer: https://www.ravimiregister.ee/")
Get-File "PL\overall.xml" "https://rejestry.ezdrowie.gov.pl/api/rpl/medicinal-products/public-pl-report/6.0.0/overall.xml"
Get-File "IT\liste.html" "https://www.aifa.gov.it/liste-dei-farmaci"
Get-File "FI\xml.html" "https://fimea.fi/en/databases_and_registers/basic-register-xml"
Get-File "FI\xml-fi.html" "https://fimea.fi/tietoa_fimeasta/fimean_toiminta/tietojarjestelmat/laaketietokanta/perusrekisteri"
Get-File "IS\medicine.json" "https://www.lyfjastofnun.is/rest/v2/medicine/0"
Get-File "IS\medicine-en.json" "https://www.lyfjastofnun.is/en/rest/v2/medicine/0"
Get-File "SE\nsl.zip" "https://nsl.mpa.se/sensl.zip"
Get-File "SE\nsl-http.zip" "http://nsl.mpa.se/sensl.zip"
Get-File "EMA\epar.xlsx" "https://www.ema.europa.eu/sites/default/files/documents/other/medicines-output-european-public-assessment-reports_en.xlsx"
Get-File "LT\vaist.html" "https://get.data.gov.lt/datasets/gov/vvkt/vaistiniai_preparatai"
Get-File "SK\p00000.json" "https://api.sukl.sk/json/lieky_ui42.php?limit=1000&offset=0"
Get-File "ES\cima_001.json" "https://cima.aemps.es/cima/rest/medicamentos?pagina=1"
Write-Host "curl batch done"
