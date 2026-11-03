import { useState } from 'react'

type Props = {
  /** 题号，如 1 */
  n: number
  /** 总题数 */
  of: number
  /** 题干 */
  q: string
  /** 选项。字数尽量等长，正确项位置打散 —— 别从格式上泄露答案 */
  options: string[]
  /** 正确项下标，从 0 开始 */
  answer: number
  /** 答对时的反馈 */
  ok: string
  /** 答错时的反馈 */
  no: string
}

/**
 * 测验组件。用于 MDX：
 *
 *   <Quiz n={1} of={3} q="…" options={['A','B','C']} answer={1} ok="…" no="…" />
 *
 * 反馈立刻出现 —— 反馈闭环越紧，记忆留存越好。
 */
export function Quiz({ n, of, q, options, answer, ok, no }: Props) {
  const [picked, setPicked] = useState<number | null>(null)
  const done = picked !== null
  const right = picked === answer

  const stateFor = (i: number): string | undefined => {
    if (!done) return undefined
    if (i === answer) return 'correct'
    if (i === picked) return 'wrong'
    return 'dim'
  }

  return (
    <div className="quiz">
      <div className="quiz-qnum">
        问题 {n} / {of}
      </div>
      <div className="quiz-qtext">{q}</div>
      {options.map((opt, i) => (
        <button
          key={i}
          type="button"
          className="quiz-opt"
          data-state={stateFor(i)}
          disabled={done}
          onClick={() => setPicked(i)}
        >
          {opt}
        </button>
      ))}
      {done && (
        <div className="quiz-fb" data-kind={right ? 'ok' : 'no'}>
          {right ? ok : no}
        </div>
      )}
    </div>
  )
}

/** 一组测验的容器，负责题号自增，省得每题手写 n/of */
export function QuizSet({ children }: { children: React.ReactNode }) {
  return <div className="quiz-set">{children}</div>
}
