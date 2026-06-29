// https://github.com/eclipsesource/pdf-maker/
import { PdfMaker, type Block, type ColumnsBlock, type DocumentDefinition, type TextBlock, text } from 'pdfmkr'
import { GoogleGenAI } from '@google/genai'

// http utilities

function validateHttpResponse(response: Response) {
	if (!response.ok)
		throw new Error(`HTTP error: received response of status ${response.status} (${response.statusText}) from ${response.url}`)
}

// ai utilities

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY_GEMINI })

async function askLlm(prompt: string, systemPrompt: string = '', responseJsonSchema = {}): Promise<string> {
	const response = await ai.models.generateContent({
		model: 'gemini-3.5-flash',
		contents: prompt,
		config: {
			temperature: 0.0,
			seed: 41,
			frequencyPenalty: 0.0,
			presencePenalty: 0.0,
			systemInstruction: systemPrompt,
			responseMimeType: 'application/json',
			responseJsonSchema,
		}
	})
	return response.text
}

// aquifer utilities

async function aquiferFetch(apiPath: string, queryParams: URLSearchParams): Promise<any> {
	return fetch(`https://api.aquifer.bible${apiPath}?${queryParams.toString()}`, {
		headers: {
			"api-key": process.env.API_KEY_AQUIFER,
		},
	})
}

async function getAquiferContentIds(params): Promise<number[]> {
	const queryParams = new URLSearchParams({
		languageCode: 'eng',
		resourceCollectionCode: 'SILOpenTranslatorsNotes',
		bookCode: usfmBookCodeByBookName.filter(x => x.key == params.bookName)[0].value,
		startChapter: params.chapterNo,
		endChapter: params.chapterNo,
		startVerse: params.verseNo,
		endVerse: params.verseNo
	})
	const response = await aquiferFetch('/resources/search', queryParams)
	validateHttpResponse(response);
	return (await response.json()).items.map(({id}) => id)
}

// usfm utilities

const usfmBookCodeByBookName = [
	{ key: 'Genesis', value: 'GEN' },
	{ key: 'Exodus', value: 'EXO' },
	{ key: 'Leviticus', value: 'LEV' },
	{ key: 'Numbers', value: 'NUM' },
	{ key: 'Deuteronomy', value: 'DEU' },
	{ key: 'Joshua', value: 'JOS' },
	{ key: 'Judges', value: 'JDG' },
	{ key: 'Ruth', value: 'RUT' },
	{ key: '1 Samuel', value: '1SA' },
	{ key: '2 Samuel', value: '2SA' },
	{ key: '1 Kings', value: '1KI' },
	{ key: '2 Kings', value: '2KI' },
	{ key: '1 Chronicles', value: '1CH' },
	{ key: '2 Chronicles', value: '2CH' },
	{ key: 'Ezra', value: 'EZR' },
	{ key: 'Nehemiah', value: 'NEH' },
	{ key: 'Esther', value: 'EST' },
	{ key: 'Job', value: 'JOB' },
	{ key: 'Psalms', value: 'PSA' },
	{ key: 'Proverbs', value: 'PRO' },
	{ key: 'Ecclesiastes', value: 'ECC' },
	{ key: 'Song of Songs', value: 'SNG' },
	{ key: 'Isaiah', value: 'ISA' },
	{ key: 'Jeremiah', value: 'JER' },
	{ key: 'Lamentations', value: 'LAM' },
	{ key: 'Ezekiel', value: 'EZK' },
	{ key: 'Daniel', value: 'DAN' },
	{ key: 'Hosea', value: 'HOS' },
	{ key: 'Joel', value: 'JOL' },
	{ key: 'Amos', value: 'AMO' },
	{ key: 'Obadiah', value: 'OBA' },
	{ key: 'Jonah', value: 'JON' },
	{ key: 'Micah', value: 'MIC' },
	{ key: 'Nahum', value: 'NAM' },
	{ key: 'Habakkuk', value: 'HAB' },
	{ key: 'Zephaniah', value: 'ZEP' },
	{ key: 'Haggai', value: 'HAG' },
	{ key: 'Zechariah', value: 'ZEC' },
	{ key: 'Malachi', value: 'MAL' },

	{ key: 'Matthew', value: 'MAT' },
	{ key: 'Mark', value: 'MRK' },
	{ key: 'Luke', value: 'LUK' },
	{ key: 'John', value: 'JHN' },
	{ key: 'Acts', value: 'ACT' },
	{ key: 'Romans', value: 'ROM' },
	{ key: '1 Corinthians', value: '1CO' },
	{ key: '2 Corinthians', value: '2CO' },
	{ key: 'Galatians', value: 'GAL' },
	{ key: 'Ephesians', value: 'EPH' },
	{ key: 'Philippians', value: 'PHP' },
	{ key: 'Colossians', value: 'COL' },
	{ key: '1 Thessalonians', value: '1TH' },
	{ key: '2 Thessalonians', value: '2TH' },
	{ key: '1 Timothy', value: '1TI' },
	{ key: '2 Timothy', value: '2TI' },
	{ key: 'Titus', value: 'TIT' },
	{ key: 'Philemon', value: 'PHM' },
	{ key: 'Hebrews', value: 'HEB' },
	{ key: 'James', value: 'JAS' },
	{ key: '1 Peter', value: '1PE' },
	{ key: '2 Peter', value: '2PE' },
	{ key: '1 John', value: '1JN' },
	{ key: '2 John', value: '2JN' },
	{ key: '3 John', value: '3JN' },
	{ key: 'Jude', value: 'JUD' },
	{ key: 'Revelation', value: 'REV' }
];

// content access

async function getSource(params): Promise<string> {
	const response = await fetch(`https://targets.tabitha.bible/${params.lwcName}/${params.bookName}/${params.chapterNo}/${params.verseNo}`)
	validateHttpResponse(response);
	const json = await response.json()
	return json.filter(({ audience, text }) => { return audience == 'Unchurched Adults' })[0].text
}

async function getQuestions(params): Promise<string[]> {
	const queryParams = new URLSearchParams({
		settings: JSON.stringify({
			language_profile: params.vernacularProfile,
			mtt_level: params.mttLevel,
			lwc: params.lwcName,
			show_english: params.showEnglish,
			show_note_sources: params.showNoteSources
		}),
	})
	const response = await fetch(`https://copilot-dev.tabitha.bible/${params.bookName}/${params.chapterNo}/${params.verseNo}?${queryParams.toString()}`)
	validateHttpResponse(response);
	const json = await response.json()
	return json.cautions.map(({ note, source }) => note)
}

async function getTnnBasedInfo(params): Promise<any> {
	// get prompt from Aquifer
	const contentId = (await getAquiferContentIds(params))[0]
	const response = await fetch(`https://api.aquifer.bible/resources/${contentId}`, {
		headers: {
			"api-key": process.env.API_KEY_AQUIFER,
		},
	})
	validateHttpResponse(response);
	const prompt = await response.text()

	const systemPrompt = await Bun.file('prompts/tnn-system.txt').text()
	const responseJsonSchema = {
		type: 'object',
		properties: {
			section1: {
				type: 'string',
				description: 'Extracted TNN Notes',
			},
			section2: {
				type: 'string',
				description: 'Cultural Context Summary',
			},
			section3: {
				type: 'string',
				description: 'Image Keywords',
			},
			section4: {
				type: 'string',
				description: 'Consultant Note Candidate',
			},
		},
	}
	return await askLlm(prompt, systemPrompt, responseJsonSchema)
}

// pdf styles
const TEXT = {
	fontFamily: 'Times New Roman',
	fontSize: 12,
}
const TITLE = {
	fontSize: 28,
	fontWeight: 'bold',
	textAlign: 'center',
}
const SUBTITLE = {
	fontSize: 18,
	textAlign: 'center',
}
const H1 = {
	fontSize: 18,
	fontWeight: 'bold',
	margin: {y: 10},
}

// pdf composition

function composeText(source: string): Block[] {
	return [text(source)]
}

function composeUnorderedList(questions: string[]): Block[] {
	return questions.map(question => text(`\u2022 ${question}`))
}

// main

const input = await Bun.stdin.json()

const tnnBasedInfo = JSON.parse(await getTnnBasedInfo(input))

const doc: DocumentDefinition = {
	defaultStyle: TEXT,
	content: [
		text('TaBiThA Brief', TITLE),
		text(`${input.bookName} ${input.chapterNo}:${input.verseNo} · ${input.lwcName}`, SUBTITLE),

		text('3 \u2014 TBTA LWC Rendering with Alternates', H1),
		...composeText(await getSource(input)),

		text('2 \u2014 Probing Discussion Questions', H1),
		...composeUnorderedList(await getQuestions(input)),

		text('4 \u2014 Extracted TNN Notes', H1),
		...composeText(tnnBasedInfo.section1),

		text('5 \u2014 Cultural Context Summary', H1),
		...composeText(tnnBasedInfo.section2),

		text('6 \u2014 Contextual Images', H1),
		...composeText(tnnBasedInfo.section3),

		text('7 \u2014 Consultant / Pastoral Notes', H1),
		...composeText(tnnBasedInfo.section4),
	],
}

const pdfMaker = new PdfMaker()
pdfMaker.registerFont(await Bun.file('fonts/Times New Roman.ttf').arrayBuffer())

await Bun.write(Bun.stdout, await pdfMaker.makePdf(doc))
