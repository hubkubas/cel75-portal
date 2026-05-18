import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import creds from '../credentials.json';

async function getSheetData() {
  const serviceAccountAuth = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes:['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  // Wklej tutaj swoje ID arkusza
  const doc = new GoogleSpreadsheet('1MOpF9G7bghLcl1-9WbMV-vc_VWD2mvqK5PrRMK5ZLHE', serviceAccountAuth);
  
  await doc.loadInfo();
  // Upewnij się, że nazwa zakładki w Sheets to dokładnie "Raport"
  const sheet = doc.sheetsByTitle['Raport']; 
  const rows = await sheet.getRows();
  
  return rows.map(row => row.toObject());
}

export default async function Page() {
  const data = await getSheetData();

  return (
    <main className="p-10 bg-gray-950 text-white min-h-screen">
      <h1 className="text-4xl font-bold mb-10 text-blue-400">CEL 75 - Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.map((training: any, index: number) => (
          <div key={index} className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-xl">
            <h2 className="text-xl font-semibold mb-2 text-white">{training["Nazwa Treningu"]}</h2>
            <p className="text-gray-400 text-sm">{training["Data"]}</p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="bg-gray-800 p-2 rounded">Dystans: <span className="text-blue-300">{training["Dystans"]}</span></div>
              <div className="bg-gray-800 p-2 rounded">Czas: {Math.floor(training["Czas"] / 60)} min</div>
              <div className="bg-gray-800 p-2 rounded">Kalorie: {training["Kalorie"]}</div>
              <div className="bg-gray-800 p-2 rounded">Kadencja: {training["Srednia Kadencja"]}</div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}