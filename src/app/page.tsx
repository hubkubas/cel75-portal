import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import fs from 'fs';
import path from 'path';

async function getSheetData() {
  try {
    // Odczytujemy plik bezpośrednio z systemu plików, co jest najpewniejsze
    const filePath = path.join(process.cwd(), 'src', 'credentials.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const creds = JSON.parse(fileContents);

    const serviceAccountAuth = new JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes:['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const doc = new GoogleSpreadsheet('1MOpF9G7bghLcl1-9WbMV-vc_VWD2mvqK5PrRMK5ZLHE', serviceAccountAuth);
    
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle['Raport']; 
    await sheet.loadHeaderRow(); 
    const rows = await sheet.getRows();
    
    return rows.map(row => row.toObject());
  } catch (error) {
    console.error("Błąd podczas pobierania danych:", error);
    throw error;
  }
}

export default async function Page() {
  let data: any[] =[];
  let errorMsg = null;

  try {
    data = await getSheetData();
  } catch (e: any) {
    errorMsg = e.message;
  }

  return (
    <main className="p-10 bg-gray-950 text-white min-h-screen">
      <h1 className="text-4xl font-bold mb-10 text-blue-400">CEL 75 - Dashboard</h1>
      
      {errorMsg ? (
        <div className="bg-red-900 p-6 rounded-lg border border-red-700">
          <h2 className="text-xl font-bold text-red-100">Błąd połączenia:</h2>
          <p className="mt-2 text-red-300 font-mono text-sm">{errorMsg}</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {data.map((training: any, index: number) => (
            <div key={index} className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-xl hover:border-blue-500 transition-all">
              <h2 className="text-xl font-semibold mb-2">{training["Nazwa Treningu"] || "Bez nazwy"}</h2>
              <p className="text-gray-400 text-sm mb-4">{training["Data"]}</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-800 p-3 rounded text-center">
                  <div className="text-gray-500 text-xs uppercase">Dystans</div>
                  <div className="font-bold text-blue-300">{training["Dystans"]}</div>
                </div>
                <div className="bg-gray-800 p-3 rounded text-center">
                  <div className="text-gray-500 text-xs uppercase">Czas</div>
                  <div className="font-bold text-green-300">{Math.floor(Number(training["Czas"]) / 60)} min</div>
                </div>
                <div className="bg-gray-800 p-3 rounded text-center">
                  <div className="text-gray-500 text-xs uppercase">Średnia kadencja</div>
                  <div className="font-bold text-blue-300">{training["Srednia Kadencja"]}</div>
                </div>
                <div className="bg-gray-800 p-3 rounded text-center">
                  <div className="text-gray-500 text-xs uppercase">Kalorie</div>
                  <div className="font-bold text-blue-300">{training["Kalorie"]}</div>
                </div>
                <div className="bg-gray-800 p-3 rounded text-center">
                  <div className="text-gray-500 text-xs uppercase">Tetno</div>
                  <div className="font-bold text-blue-300">{training["Tetno"]}</div>
                </div>
                <div className="bg-gray-800 p-3 rounded text-center">
                  <div className="text-gray-500 text-xs uppercase">Max tętno</div>
                  <div className="font-bold text-blue-300">{training["Max Tetno"]}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}