// https://github.com/eclipsesource/pdf-maker/
import { PdfMaker, type Block, type ColumnsBlock, type DocumentDefinition, type TextBlock, text } from 'pdfmkr'
import { GoogleGenAI } from '@google/genai'

// ai utilities

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY_GEMINI })

async function askLlm(prompt: string, systemPrompt: string = '', responseJsonSchema = {}): Promise<string> {
	const response = await ai.models.generateContent({
		model: 'gemini-2.5-flash',
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

// content access

async function getSource(params): Promise<string> {
	const result = await fetch(`https://targets.tabitha.bible/${params.lwcName}/${params.bookName}/${params.chapterNo}/${params.verseNo}`)
	const json = await result.json()
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
	const result = await fetch(`https://copilot-dev.tabitha.bible/${params.bookName}/${params.chapterNo}/${params.verseNo}?${queryParams.toString()}`,
	)
	const json = await result.json()
	return json.cautions.map(({ note, source }) => note)
}

async function getTnnBasedInfo(params): Promise<any> {
	// TODO: get prompt from TNN's API instead
	const prompt = await Bun.file('prompts/tnn-hardcoded.txt').text()

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
