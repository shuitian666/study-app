$content = Get-Content "C:\Users\35460\study-app\src\store\AppContext.tsx" -Raw -Encoding UTF8

# 添加Action
$oldAction = "  | { type: 'SET_DAILY_ENCOURAGEMENT'; payload: { text: string; date: string } };"
$newAction = "  | { type: 'SET_DAILY_ENCOURAGEMENT'; payload: { text: string; date: string } }
  // Question explanation actions
  | { type: 'SAVE_QUESTION_EXPLANATION'; payload: QuestionExplanation }
  | { type: 'UPDATE_QUESTION_EXPLANATION'; payload: { questionId: string; explanation: string } }
  | { type: 'DELETE_QUESTION_EXPLANATION'; payload: string };"

$content = $content.Replace($oldAction, $newAction)

# 添加reducer case
$oldReducer = "    case 'SET_DAILY_ENCOURAGEMENT':
      return {
        ...state,
        dailyEncouragement: action.payload.text,
        dailyEncouragementDate: action.payload.date,
      };

    default:"
$newReducer = "    case 'SET_DAILY_ENCOURAGEMENT':
      return {
        ...state,
        dailyEncouragement: action.payload.text,
        dailyEncouragementDate: action.payload.date,
      };

    // Question explanation actions
    case 'SAVE_QUESTION_EXPLANATION': {
      const exists = state.questionExplanations.find(e => e.questionId === action.payload.questionId);
      if (exists) return state;
      return {
        ...state,
        questionExplanations: [...state.questionExplanations, action.payload],
      };
    }
    case 'UPDATE_QUESTION_EXPLANATION':
      return {
        ...state,
        questionExplanations: state.questionExplanations.map(e =>
          e.questionId === action.payload.questionId
            ? { ...e, explanation: action.payload.explanation, updatedAt: new Date().toISOString(), isUserModified: true }
            : e
        ),
      };
    case 'DELETE_QUESTION_EXPLANATION':
      return {
        ...state,
        questionExplanations: state.questionExplanations.filter(e => e.questionId !== action.payload),
      };

    default:"

$content = $content.Replace($oldReducer, $newReducer)

[System.IO.File]::WriteAllText("C:\Users\35460\study-app\src\store\AppContext.tsx", $content, [System.Text.Encoding]::UTF8)
Write-Output "Added explanation actions and reducers"
